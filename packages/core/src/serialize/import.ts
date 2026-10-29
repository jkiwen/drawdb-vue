import { createEmptyDiagram } from "../models/diagram.ts";
import type { DatabaseType, Diagram } from "../models/diagram.ts";
import type { Area } from "../models/area.ts";
import type { Enum } from "../models/enum.ts";
import type { FieldId } from "../models/field.ts";
import { normalizeDiagramKeys } from "../models/key-migration.ts";
import type { LogicalRelationship } from "../models/logical-relationship.ts";
import type { Note } from "../models/note.ts";
import { normalizeViewState } from "../models/view-state.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import type { CustomType } from "../models/type.ts";
import type { View } from "../models/view.ts";
import { ImportError } from "./types.ts";

export interface ImportDiagramJsonOptions {
  /** The dialect of the host application. */
  database?: DatabaseType;
  /** Accepts a diagram whose dialect differs from the one of the host. */
  allowDatabaseOverride?: boolean;
}

/** The dialects that a diagram can have. */
const DATABASE_TYPES: readonly DatabaseType[] = [
  "mysql",
  "postgres",
  "sqlite",
  "mariadb",
  "mssql",
  "oraclesql",
  "generic",
];

/** True when the value is a dialect of a diagram. */
function isDatabaseType(value: unknown): value is DatabaseType {
  return (
    typeof value === "string" &&
    (DATABASE_TYPES as readonly string[]).includes(value)
  );
}

/** The value of a property of the source, or undefined. */
function property(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

/**
 * The value of a property that has to be a list. A property that is missing
 * is an empty list, a property of another shape is an error.
 */
function collection(
  record: Record<string, unknown>,
  key: string,
  legacyKey?: string,
): unknown[] {
  const value = property(record, key) ?? (legacyKey ? property(record, legacyKey) : undefined);
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ImportError(
      "json.invalid_shape",
      `The ${key} of the diagram are not a list.`,
    );
  }
  return value;
}

/**
 * Reads a diagram from json.
 *
 * The source is the text of a json document, or an object that has already
 * been parsed. The old field names of the React reference (`references` and
 * `areas`) are accepted as well.
 */
export function importDiagramJson(
  source: string | unknown,
  options: ImportDiagramJsonOptions = {},
): Diagram {
  let raw: unknown = source;

  if (typeof source === "string") {
    try {
      raw = JSON.parse(source);
    } catch (error) {
      throw new ImportError(
        "json.parse_failed",
        "The diagram is not valid JSON.",
        [
          {
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      );
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ImportError(
      "json.invalid_shape",
      "The diagram is not a JSON object.",
    );
  }

  const record = raw as Record<string, unknown>;

  const tables = property(record, "tables");
  if (!Array.isArray(tables)) {
    throw new ImportError(
      "json.invalid_shape",
      "The diagram has no tables.",
    );
  }

  const relationships = collection(record, "relationships", "references");
  const subjectAreas = collection(record, "subjectAreas", "areas");

  const rawDatabase = property(record, "database");
  let database: DatabaseType = "generic";
  if (rawDatabase !== undefined && rawDatabase !== null) {
    if (!isDatabaseType(rawDatabase)) {
      throw new ImportError(
        "json.invalid_shape",
        `The diagram has an unknown dialect: ${String(rawDatabase)}.`,
      );
    }
    database = rawDatabase;
  }

  if (
    options.database !== undefined &&
    options.database !== database &&
    options.allowDatabaseOverride !== true
  ) {
    throw new ImportError(
      "database.mismatch",
      `The diagram is a ${database} diagram, not a ${options.database} one.`,
    );
  }

  const tableList = normalizeFieldReferences(tables as Table[]);
  const relationshipList = (relationships ?? []) as Relationship[];
  const areaList = (subjectAreas ?? []) as Area[];

  assertRelationshipsAreComplete(tableList, relationshipList);

  const diagram = createEmptyDiagram({
    id: typeof property(record, "id") === "string" ? (property(record, "id") as string) : undefined,
    title: typeof property(record, "title") === "string" ? (property(record, "title") as string) : undefined,
    database,
  });

  const description = property(record, "description");
  if (typeof description === "string") {
    diagram.description = description;
  }

  const sqlHeader = property(record, "sqlHeader");
  if (typeof sqlHeader === "string") {
    diagram.sqlHeader = sqlHeader;
  }

  diagram.tables = [...tableList];
  diagram.relationships = [...relationshipList];
  diagram.logicalRelationships = [
    ...(collection(record, "logicalRelationships") as LogicalRelationship[]),
  ];
  diagram.notes = [...(collection(record, "notes") as Note[])];
  diagram.subjectAreas = [...areaList];
  diagram.types = [...(collection(record, "types") as CustomType[])];
  diagram.enums = [...(collection(record, "enums") as Enum[])];
  diagram.views = [...(collection(record, "views") as View[])];

  const metadata = property(record, "metadata");
  if (metadata && typeof metadata === "object") {
    diagram.metadata = metadata as Diagram["metadata"];
  }

  // The view state is optional in the document; a legacy document keeps the
  // defaults of `createEmptyDiagram`, a partial one is completed field by
  // field (UI document section 9.2, ruling Q2).
  diagram.viewState = normalizeViewState(property(record, "viewState"));

  // The keys are objects now (spec section 3.8.3, P2' task 2): a legacy document
  // still carries a primary flag per field, unique constraints and indices made
  // of field ids. The loader rewrites them once, so every reader afterwards
  // sees one shape only.
  return normalizeDiagramKeys(diagram);
}

/**
 * Normalizes the field references of indices and unique constraints to
 * field ids. Legacy documents stored the field names there; a name that
 * matches no field id is resolved by name, anything else is kept as is.
 * The source tables are not mutated.
 */
function normalizeFieldReferences(tables: Table[]): Table[] {
  return tables.map((table) => {
    const fields = table.fields ?? [];
    const toId = (ref: FieldId): FieldId => {
      const byId = fields.find((f) => String(f?.id) === String(ref));
      if (byId) return byId.id;
      const byName = fields.find((f) => f?.name === ref);
      return byName ? byName.id : ref;
    };
    return {
      ...table,
      indices: table.indices?.map((ix) => ({
        ...ix,
        fields: (ix.fields ?? []).map(toId),
      })),
      uniqueConstraints: table.uniqueConstraints?.map((uc) => ({
        ...uc,
        fields: (uc.fields ?? []).map(toId),
      })),
    };
  });
}

/**
 * Checks that every relationship of the diagram points at a table and at a
 * field that the diagram has.
 */
function assertRelationshipsAreComplete(
  tables: Table[],
  relationships: Relationship[],
): void {
  for (const relationship of relationships) {
    const startTable = tables.find(
      (table) => String(table?.id) === String(relationship?.startTableId),
    );
    const endTable = tables.find(
      (table) => String(table?.id) === String(relationship?.endTableId),
    );

    if (!startTable || !endTable) {
      throw new ImportError(
        "relationship.missing_table",
        `The relationship ${String(relationship?.name ?? relationship?.id)} points at a table that the diagram does not have.`,
      );
    }

    const startField = (startTable.fields ?? []).find(
      (field) => String(field?.id) === String(relationship?.startFieldId),
    );
    const endField = (endTable.fields ?? []).find(
      (field) => String(field?.id) === String(relationship?.endFieldId),
    );

    if (!startField || !endField) {
      throw new ImportError(
        "relationship.missing_field",
        `The relationship ${String(relationship?.name ?? relationship?.id)} points at a field that the diagram does not have.`,
      );
    }
  }
}
