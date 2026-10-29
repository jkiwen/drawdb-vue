/**
 * Maps an erwin document onto a diagram (P7, spec section 16).
 *
 * The mapping is deliberately plain: a table keeps the physical name and the
 * logical entity keeps the model name (section 2), the physical type is the
 * one the file states and it is marked `imported` so a reader never mistakes
 * it for a mapping the type system computed (Q8), and every part the reader
 * skipped becomes an invalid marker on the table that would have held it.
 */
import type { DatabaseType, Diagram, LogicalAttribute, LogicalEntity, LogicalTypeRef, PhysicalField, PrimaryKey, Relationship, Table } from "../models/index.ts";
import type { InvalidMarker } from "../models/invalid-marker.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { normalizeDiagramKeys } from "../models/key-migration.ts";
import { nextKeyName } from "../models/key-names.ts";
import type { ErwinDocument, ErwinEntity, ErwinField, ErwinSkip } from "./erwin-model.ts";
import { parseXml } from "./xml.ts";
import { readErwinDocument } from "./erwin-model.ts";

/** What the import did, in the numbers a report shows. */
export interface ErwinImportReport {
  version: string;
  entities: number;
  attributes: number;
  fields: number;
  domains: number;
  relationships: number;
  /** Everything the reader could not turn into a value, in file order. */
  skipped: ErwinSkip[];
  markers: InvalidMarker[];
  /** One sentence per decision the user may want to check. */
  notes: string[];
}

export interface ErwinImportResult {
  diagram: Diagram;
  report: ErwinImportReport;
}

export interface ErwinImportOptions {
  /** The dialect the imported physical types are read as; erwin is usually mssql. */
  database?: DatabaseType;
  /** The title of the diagram, when the caller knows a better one than the file. */
  title?: string;
}

const COLUMN_GAP = 320;
const ROW_GAP = 300;
const ORIGIN = { x: 80, y: 80 };
const COLUMNS = 3;

/** The logical family an erwin type name belongs to (section 3.2 families). */
const FAMILY_BY_TYPE: ReadonlyArray<[RegExp, string]> = [
  [/^(tiny|small|medium|big)?\s*int(eger)?|^int[248]$|^serial|^long/i, "integer"],
  [/^(decimal|numeric|number|money|smallmoney)/i, "decimal"],
  [/^(float|double|real)/i, "float"],
  [/^(varchar|nvarchar|varchar2|nvarchar2|char|nchar|text|ntext|clob|nclob|string|long)/i, "string"],
  [/^(date)$/i, "date"],
  [/^(datetime|timestamp|timestamptz|datetime2|smalldatetime)/i, "datetime"],
  [/^(blob|clob_binary|binary|varbinary|raw|image|bytea)/i, "binary"],
  [/^(bool|boolean|bit)/i, "boolean"],
  [/^(uuid|uniqueidentifier)/i, "uuid"],
  [/^(json|jsonb)/i, "json"],
];

/** The family of a type name, or `common` when the file names something else. */
export function familyOfType(typeName: string | undefined): string {
  if (!typeName) return "string";
  for (const [pattern, family] of FAMILY_BY_TYPE) {
    if (pattern.test(typeName.trim())) return family;
  }
  return "common";
}

/** A `LogicalTypeRef` for a family the type system knows. */
function logicalTypeOf(attribute: { typeName?: string }): LogicalTypeRef {
  return { family: familyOfType(attribute.typeName) };
}

function positionOf(index: number): { x: number; y: number } {
  return {
    x: ORIGIN.x + (index % COLUMNS) * COLUMN_GAP,
    y: ORIGIN.y + Math.floor(index / COLUMNS) * ROW_GAP,
  };
}

function physicalOf(field: ErwinField): PhysicalField {
  const type = field.type;
  return {
    id: field.id,
    name: field.name,
    fieldType: {
      type: type?.name ?? "",
      length: type?.length,
      precision: type?.precision,
      scale: type?.scale,
    },
    fieldTypeSource: "imported",
    comment: field.description,
    nullable: field.nullable ?? true,
  };
}

/** Reads one entity into a table with its logical entity and its fields. */
function tableOf(entity: ErwinEntity, index: number, report: ErwinImportReport): Table {
  const fields = entity.fields.map(physicalOf);
  const fieldById = new Map(fields.map((field) => [field.id, field]));

  const attributes: LogicalAttribute[] = [];
  for (const attribute of entity.attributes) {
    const paired = attribute.fieldId ? fieldById.get(attribute.fieldId) : undefined;
    if (attribute.fieldId && !paired) {
      report.skipped.push({
        path: `Entity[${index}]/Attribute`,
        sourceName: attribute.name,
        reason: "asymmetric",
        detail: `the attribute "${attribute.name}" points at a field the file does not have`,
      });
    }
    attributes.push({
      id: attribute.id,
      name: attribute.name,
      description: attribute.description,
      logicalType: logicalTypeOf(attribute),
      fieldId: paired?.id,
      keyRole: attribute.primary ? "primary" : attribute.unique ? "alternate" : undefined,
      logicalOnly: paired ? undefined : true,
    });
  }

  // A field without an attribute keeps its place as a physical-only column.
  const pairedFieldIds = new Set(attributes.map((attribute) => attribute.fieldId).filter(Boolean));
  for (const field of fields) {
    if (!pairedFieldIds.has(field.id)) {
      const anyAttribute = entity.attributes.length > 0;
      if (anyAttribute) {
        report.skipped.push({
          path: `Entity[${index}]/Field`,
          sourceName: field.name,
          reason: "asymmetric",
          detail: `the field "${field.name}" has no logical attribute`,
        });
      }
      field.physicalOnly = true;
    }
  }

  const tableName = entity.physicalName;
  const logicalName = entity.logicalName;
  const taken: string[] = [];
  const primary = attributes
    .filter((attribute) => attribute.keyRole === "primary" && attribute.fieldId !== undefined)
    .map((attribute) => ({ fieldId: attribute.fieldId! }));

  let primaryKey: PrimaryKey | undefined;
  if (primary.length > 0) {
    primaryKey = {
      id: `pk_${entity.id}`,
      logicalName: nextKeyName("primary", logicalName, undefined, taken),
      name: nextKeyName("primary", tableName, undefined, taken),
      columns: primary,
    };
  }

  const logical: LogicalEntity = {
    id: `l_${entity.id}`,
    name: logicalName,
    description: entity.description,
    attributes,
  };

  const { x, y } = positionOf(index);
  return {
    id: entity.id,
    name: tableName,
    logical,
    fields,
    primaryKey,
    x,
    y,
    comment: entity.comment,
  };
}

/** Reads the relationships the file states between the entities it imported. */
function relationshipsOf(document: ErwinDocument, tables: Table[], report: ErwinImportReport): Relationship[] {
  const byId = new Map(tables.map((table) => [String(table.id), table]));
  const relationships: Relationship[] = [];
  for (const [index, source] of document.relationships.entries()) {
    const parent = source.parentId ? byId.get(source.parentId) : undefined;
    const child = source.childId ? byId.get(source.childId) : undefined;
    if (!parent || !child) {
      report.skipped.push({
        path: `Relationship[${index}]`,
        sourceName: source.name ?? source.id,
        reason: "asymmetric",
        detail: "the relationship names an entity the file does not have",
      });
      continue;
    }
    const startFieldId = source.childFieldId ?? child.fields[0]?.id;
    const endFieldId = source.parentFieldId ?? parent.fields[0]?.id;
    if (!startFieldId || !endFieldId) {
      report.skipped.push({
        path: `Relationship[${index}]`,
        sourceName: source.name ?? source.id,
        reason: "asymmetric",
        detail: "the relationship names no field to connect",
      });
      continue;
    }
    relationships.push({
      id: source.id,
      name: source.name ?? `fk_${child.name}_${parent.name}`,
      startTableId: child.id,
      startFieldId,
      endTableId: parent.id,
      endFieldId,
      fields: [{ startFieldId, endFieldId }],
    });
  }
  return relationships;
}

function markersOf(document: ErwinDocument, ownerOf: (skip: ErwinSkip) => string): InvalidMarker[] {
  return document.skipped.map((skip) => ({
    ownerId: ownerOf(skip),
    path: skip.path,
    sourceName: skip.sourceName,
    reason: skip.reason,
    original: skip.original ?? skip.detail,
  }));
}

/** Reads an erwin XML Standard File into a diagram and the report of it. */
export function importErwinXml(source: string, options: ErwinImportOptions = {}): ErwinImportResult {
  const document = readErwinDocument(parseXml(source));
  const report: ErwinImportReport = {
    version: document.version,
    entities: document.entities.length,
    attributes: document.entities.reduce((total, entity) => total + entity.attributes.length, 0),
    fields: document.entities.reduce((total, entity) => total + entity.fields.length, 0),
    domains: document.domains.length,
    relationships: document.relationships.length,
    skipped: document.skipped,
    markers: [],
    notes: [],
  };

  const tables: Table[] = document.entities.map((entity, index) => tableOf(entity, index, report));
  const relationships = relationshipsOf(document, tables, report);

  const diagram: Diagram = {
    ...createEmptyDiagram(),
    database: options.database ?? "mssql",
    title: options.title ?? "Imported from erwin",
    tables,
    relationships,
  };

  report.markers = markersOf(document, (skip) => {
    const entityIndex = /^Entity\[(\d+)\]/.exec(skip.path);
    const entity = entityIndex ? document.entities[Number(entityIndex[1])] : undefined;
    return entity?.id ?? diagram.id ?? "diagram";
  });
  diagram.invalidMarkers = report.markers;

  if (document.domains.length > 0) {
    report.notes.push(`${document.domains.length} domains are read but not attached to the diagram; register them in the type system.`);
  }
  const unknownFamilies = tables
    .flatMap((table) => table.logical.attributes)
    .filter((attribute) => attribute.logicalType && "family" in attribute.logicalType && attribute.logicalType.family === "common");
  if (unknownFamilies.length > 0) {
    report.notes.push(`${unknownFamilies.length} logical types have no family of their own and were read as common.`);
  }

  return { diagram: normalizeDiagramKeys(diagram), report };
}
