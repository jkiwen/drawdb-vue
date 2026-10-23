import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import { getTypeMetadata } from "../export/dialect-meta.ts";
import {
  escapeQuotes,
  getRelationshipFields,
  isFunction,
  isKeyword,
} from "../export/shared.ts";
import {
  dbmlFieldSize,
  dbmlTypeName,
  inlineEnumTypeName,
  isInlineEnumType,
  quoteIdentifier,
} from "./types.ts";

function parseDefaultDbml(field: Field, database: string): string {
  if (isFunction(String(field.default))) {
    return `\`${field.default}\``;
  }

  if (
    isKeyword(String(field.default)) ||
    !getTypeMetadata(database as Diagram["database"], field.type)?.hasQuotes
  ) {
    return String(field.default);
  }

  return `'${escapeQuotes(String(field.default))}'`;
}

function columnDefault(field: Field, database: string): string {
  if (!field.default) return "";

  if (typeof field.default === "string" && !field.default.trim()) {
    return "";
  }

  return `default: ${parseDefaultDbml(field, database)}`;
}

function columnComment(field: Field): string {
  if (!field.comment || field.comment.trim() === "") return "";
  return `note: ${processComment(field.comment)}`;
}

function columnSettings(field: Field, database: string): string {
  const constraints = [
    field.primary && "pk",
    field.increment && "increment",
    field.notNull && "not null",
    field.unique && "unique",
    columnDefault(field, database),
    columnComment(field),
  ].filter(Boolean) as string[];

  if (!constraints.length) return "";

  return ` [ ${constraints.join(", ")} ]`;
}

function cardinalitySymbol(rel: Relationship): string | null {
  switch (rel.cardinality) {
    case "one_to_one":
      return "-";
    case "one_to_many":
      return "<";
    case "many_to_one":
      return ">";
    default:
      return null;
  }
}

function processComment(comment: string): string {
  if (comment.includes("\n")) {
    return `'''${comment}'''`;
  }

  return `'${escapeQuotes(comment)}'`;
}

function enumBlock(name: string, values: string[]): string {
  const body = values.map((value) => `\t${quoteIdentifier(value)}`).join("\n");
  return `enum ${quoteIdentifier(name)} {\n${body}\n}`;
}

function enumNameIndex(
  enums: Array<{ name: string }>,
): Map<string, string> {
  return new Map(enums.map((en) => [String(en.name).toUpperCase(), en.name]));
}

function inlineEnumBlocks(tables: Table[]): string[] {
  const declared = new Set<string>();
  const blocks: string[] = [];

  for (const table of tables) {
    for (const field of table.fields) {
      if (!isInlineEnumType(field.type) || !Array.isArray(field.values)) {
        continue;
      }

      const name = inlineEnumTypeName(field);
      if (declared.has(name)) continue;

      declared.add(name);
      blocks.push(enumBlock(name, field.values));
    }
  }

  return blocks;
}

function indexEntry(
  fields: string[] | undefined,
  name: string,
  unique: boolean,
): string | null {
  if (!Array.isArray(fields) || !fields.length) return null;

  const settings = [
    name ? `name: '${escapeQuotes(String(name))}'` : "",
    unique ? "unique" : "",
  ].filter(Boolean);
  const columns = fields.map((field) => quoteIdentifier(field)).join(", ");

  return `\t\t(${columns})${settings.length ? ` [ ${settings.join(", ")} ]` : ""}`;
}

function indexesBlock(table: Table): string {
  const entries = [
    ...(table.indices ?? []).map((index) =>
      indexEntry(index.fields, index.name, index.unique),
    ),
    ...(table.uniqueConstraints ?? []).map((constraint) =>
      indexEntry(constraint.fields, constraint.name, true),
    ),
  ].filter(Boolean) as string[];

  if (!entries.length) return "";

  return `\n\n\tindexes {\n${entries.join("\n")}\n\t}`;
}

function tableBlock(
  table: Table,
  database: string,
  enumNames: Map<string, string>,
): string {
  const headerColor = table.color ? ` [headercolor: ${table.color}]` : "";
  const fields = table.fields
    .map(
      (field) =>
        `\t${quoteIdentifier(field.name)} ${quoteIdentifier(
          dbmlTypeName(field, enumNames),
        )}${dbmlFieldSize(field, database as Diagram["database"])}${columnSettings(field, database)}`,
    )
    .join("\n");
  const comment =
    table.comment && table.comment.trim() !== ""
      ? `\n\n\tNote: ${processComment(table.comment)}`
      : "";

  return `Table ${quoteIdentifier(table.name)}${headerColor} {\n${fields}${indexesBlock(table)}${comment}\n}`;
}

function columnRef(tableName: string, fieldNames: string[]): string {
  const columns = fieldNames.map((name) => quoteIdentifier(name));
  const target = columns.length === 1 ? columns[0] : `(${columns.join(", ")})`;
  return `${quoteIdentifier(tableName)}.${target}`;
}

function constraintKeyword(constraint: string | undefined): string {
  return String(constraint ?? "No action").toLowerCase();
}

function refBlock(rel: Relationship, tables: Table[]): string | null {
  const startTable = tables.find((table) => table.id === rel.startTableId);
  const endTable = tables.find((table) => table.id === rel.endTableId);
  if (!startTable || !endTable) return null;

  const symbol = cardinalitySymbol(rel);
  if (!symbol) return null;

  const pairs = getRelationshipFields(rel);
  const startFields = pairs.map(
    (pair) => startTable.fields.find((f) => f.id === pair.startFieldId)?.name,
  );
  const endFields = pairs.map(
    (pair) => endTable.fields.find((f) => f.id === pair.endFieldId)?.name,
  );
  if (startFields.some((name) => !name) || endFields.some((name) => !name)) {
    return null;
  }

  const name = rel.name ? `${quoteIdentifier(rel.name)} ` : "";
  const settings = `[ delete: ${constraintKeyword(rel.deleteConstraint)}, update: ${constraintKeyword(rel.updateConstraint)} ]`;

  return `Ref ${name}{\n\t${columnRef(startTable.name, startFields as string[])} ${symbol} ${columnRef(endTable.name, endFields as string[])} ${settings}\n}`;
}

/**
 * Export a diagram as DBML.
 *
 * Tables without fields are skipped, inline enums become standalone `Enum`
 * blocks and relationships become `Ref` blocks.
 */
export function exportDBML(diagram: Diagram): string {
  const database = diagram.database;
  const enums = diagram.enums ?? [];
  const tables = (diagram.tables ?? []).filter(
    (table) => (table.fields ?? []).length > 0,
  );
  const enumNames = enumNameIndex(enums);

  return [
    ...enums.map((en) => enumBlock(en.name, en.values ?? [])),
    ...inlineEnumBlocks(tables),
    ...tables.map((table) => tableBlock(table, database, enumNames)),
    ...(diagram.relationships ?? []).map((rel) => refBlock(rel, tables)),
  ]
    .filter(Boolean)
    .join("\n\n");
}
