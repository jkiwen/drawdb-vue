import { Parser } from "@dbml/core";
import { Cardinality, Constraint } from "../models/constants.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { DatabaseType, Diagram } from "../models/diagram.ts";
import { reconcileDBML } from "./reconcile.ts";
import { inlineEnumTypeName } from "./types.ts";

/** Raised when a DBML source cannot be parsed. */
export class DBMLParseError extends Error {
  readonly diagnostics: string[];

  constructor(message: string, diagnostics: string[] = []) {
    super(message);
    this.name = "DBMLParseError";
    this.diagnostics = diagnostics;
  }
}

/** A column parsed from a DBML table body. */
export interface ParsedDBMLField {
  name: string;
  type: string;
  size: string;
  default: string;
  primary: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  comment: string;
  values?: string[];
}

/** An index parsed from a DBML table body. */
export interface ParsedDBMLIndex {
  name: string;
  fields: string[];
  unique: boolean;
}

/** A table parsed from a DBML source. */
export interface ParsedDBMLTable {
  name: string;
  comment: string;
  color: string | null;
  fields: ParsedDBMLField[];
  indices: ParsedDBMLIndex[];
}

/** A foreign key parsed from a DBML source. */
export interface ParsedDBMLRelationship {
  name: string;
  startTableName: string;
  startFieldNames: string[];
  endTableName: string;
  endFieldNames: string[];
  cardinality: string;
  deleteConstraint: string;
  updateConstraint: string;
}

/** An enum parsed from a DBML source. */
export interface ParsedDBMLEnum {
  name: string;
  values: string[];
}

/** The unresolved result of parsing a DBML source. */
export interface ParsedDBML {
  tables: ParsedDBMLTable[];
  relationships: ParsedDBMLRelationship[];
  enums: ParsedDBMLEnum[];
}

const CONSTRAINT_BY_KEYWORD: Record<string, string> = {
  "no action": Constraint.NONE,
  restrict: Constraint.RESTRICT,
  cascade: Constraint.CASCADE,
  "set null": Constraint.SET_NULL,
  "set default": Constraint.SET_DEFAULT,
};

const CARDINALITY_BY_RELATION: Record<string, string> = {
  "*:1": Cardinality.MANY_TO_ONE,
  "1:*": Cardinality.ONE_TO_MANY,
  "1:1": Cardinality.ONE_TO_ONE,
};

function baseTypeName(type: { type_name?: string } | undefined): string {
  const name = String(type?.type_name ?? "");
  const openingBracket = name.lastIndexOf("(");
  return openingBracket === -1 ? name : name.slice(0, openingBracket);
}

function fieldDefault(column: { dbdefault?: { value?: unknown } | null }): string {
  const value = column.dbdefault?.value;
  return value === undefined || value === null ? "" : String(value);
}

function parseField(
  column: {
    name: string;
    type: { type_name?: string; args?: string | null };
    pk?: boolean;
    unique?: boolean;
    not_null?: boolean;
    increment?: boolean;
    dbdefault?: { value?: unknown } | null;
    note?: string | null;
  },
  primaryKeyColumns: Set<string>,
): ParsedDBMLField {
  return {
    name: column.name,
    type: baseTypeName(column.type).toUpperCase(),
    size: column.type?.args ?? "",
    default: fieldDefault(column),
    primary: Boolean(column.pk) || primaryKeyColumns.has(column.name),
    unique: Boolean(column.unique),
    notNull: Boolean(column.not_null),
    increment: Boolean(column.increment),
    comment: column.note ?? "",
  };
}

function parseTable(table: {
  name: string;
  note?: string | null;
  headerColor?: string | null;
  fields: Array<Parameters<typeof parseField>[0]>;
  indexes: Array<{
    name?: string | null;
    unique?: boolean;
    pk?: boolean;
    columns: Array<{ value: string }>;
  }>;
}): ParsedDBMLTable {
  const compositeKey = table.indexes.find((index) => index.pk);
  const primaryKeyColumns = new Set(
    compositeKey?.columns.map((column) => column.value) ?? [],
  );

  return {
    name: table.name,
    comment: table.note ?? "",
    color: table.headerColor ?? null,
    fields: table.fields.map((field) => parseField(field, primaryKeyColumns)),
    indices: table.indexes
      .filter((index) => !index.pk)
      .map((index) => ({
        name: index.name ?? "",
        fields: index.columns.map((column) => column.value),
        unique: Boolean(index.unique),
      })),
  };
}

function constraintFor(keyword: string | undefined): string {
  return CONSTRAINT_BY_KEYWORD[String(keyword).toLowerCase()] ?? Constraint.NONE;
}

function parseRef(ref: {
  name?: string | null;
  onDelete?: string;
  onUpdate?: string;
  endpoints: Array<{
    tableName: string;
    fieldNames: string[];
    relation: string;
  }>;
}): ParsedDBMLRelationship | null {
  const [start, end] = ref.endpoints;
  if (!start || !end) return null;

  const cardinality = CARDINALITY_BY_RELATION[`${start.relation}:${end.relation}`];
  if (!cardinality) return null;

  return {
    name:
      ref.name ||
      `fk_${start.tableName}_${start.fieldNames[0]}_${end.tableName}`,
    startTableName: start.tableName,
    startFieldNames: [...start.fieldNames],
    endTableName: end.tableName,
    endFieldNames: [...end.fieldNames],
    cardinality,
    deleteConstraint: constraintFor(ref.onDelete),
    updateConstraint: constraintFor(ref.onUpdate),
  };
}

/**
 * Fold enums that were exported from an inline enum field back into the
 * field, so a round-trip through DBML does not turn an inline enum into a
 * standalone enum.
 */
function foldInlineEnums(
  tables: ParsedDBMLTable[],
  enums: ParsedDBMLEnum[],
): ParsedDBMLEnum[] {
  const enumsByName = new Map(enums.map((en) => [en.name.toUpperCase(), en]));
  const folded = new Set<string>();

  for (const table of tables) {
    for (const field of table.fields) {
      const candidate = enumsByName.get(field.type);
      if (!candidate) continue;

      const expected = inlineEnumTypeName({
        name: field.name,
        values: candidate.values,
      });
      if (expected.toUpperCase() !== field.type) continue;

      field.type = "ENUM";
      field.values = [...candidate.values];
      folded.add(candidate.name);
    }
  }

  return enums.filter((en) => !folded.has(en.name));
}

/**
 * Parse a DBML source into its unresolved parts.
 *
 * The parts are keyed by name, not by id; use `reconcileDBML` to turn them
 * into diagram entities.
 */
export function parseDBMLPartial(source: string): ParsedDBML {
  let ast: { schemas: Array<Record<string, never>> };
  try {
    ast = new Parser().parse(String(source ?? ""), "dbmlv2") as never;
  } catch (error) {
    const diags = (error as { diags?: Array<{ message?: string }> })?.diags;
    const diagnostics = Array.isArray(diags)
      ? diags.map((d) => String(d?.message ?? ""))
      : [];
    const detail = diagnostics[0] ?? (error as Error)?.message ?? "unknown error";
    throw new DBMLParseError(`Failed to parse DBML: ${detail}`, diagnostics);
  }

  const tables: ParsedDBMLTable[] = [];
  const relationships: ParsedDBMLRelationship[] = [];
  const enums: ParsedDBMLEnum[] = [];

  for (const schema of ast.schemas as unknown as Array<{
    tables: Array<Parameters<typeof parseTable>[0]>;
    refs: Array<Parameters<typeof parseRef>[0]>;
    enums: Array<{ name: string; values: Array<{ name: string }> }>;
  }>) {
    tables.push(...schema.tables.map(parseTable));
    relationships.push(
      ...schema.refs.map(parseRef).filter((rel): rel is ParsedDBMLRelationship => rel !== null),
    );
    enums.push(
      ...schema.enums.map((en) => ({
        name: en.name,
        values: en.values.map((value) => value.name),
      })),
    );
  }

  return {
    tables,
    relationships,
    enums: foldInlineEnums(tables, enums),
  };
}

/** Options accepted by `parseDBML`. */
export interface ParseDBMLOptions {
  /** The database dialect the imported diagram targets. Defaults to `generic`. */
  database?: DatabaseType;
  /** The title of the created diagram. */
  title?: string;
}

/**
 * Parse a DBML source into a diagram.
 *
 * The result is a complete diagram: every table, field and relationship
 * carries an id and the tables are laid out on the canvas.
 */
export function parseDBML(
  source: string,
  options: ParseDBMLOptions = {},
): Diagram {
  const database = options.database ?? "generic";
  const parsed = parseDBMLPartial(source);
  const reconciled = reconcileDBML(parsed, null, database);

  const diagram = createEmptyDiagram({
    database,
    title: options.title ?? "",
  });
  diagram.tables = reconciled.tables;
  diagram.relationships = reconciled.relationships;
  diagram.enums = reconciled.enums;
  return diagram;
}
