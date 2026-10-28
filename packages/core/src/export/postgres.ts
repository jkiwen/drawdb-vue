import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { TypeMetadata } from "./dialect-meta.ts";
import {
  escapeQuotes,
  exportFieldComment,
  exportLogicalNameComment,
  fieldSizeSuffix,
  getFkColumnNames,
  uniqueConstraintClause,
} from "./shared.ts";
import { appendViews } from "./views.ts";

const postgresMetadata: Record<string, TypeMetadata> = {
  SMALLINT: { isSized: false, hasPrecision: false, hasCheck: true },
  INTEGER: { isSized: false, hasPrecision: false, hasCheck: true },
  BIGINT: { isSized: false, hasPrecision: false, hasCheck: true },
  DECIMAL: { isSized: false, hasPrecision: true, hasCheck: true },
  NUMERIC: { isSized: false, hasPrecision: true, hasCheck: true },
  REAL: { isSized: false, hasPrecision: true, hasCheck: true },
  "DOUBLE PRECISION": { isSized: false, hasPrecision: true, hasCheck: true },
  SMALLSERIAL: { isSized: false, hasPrecision: false, hasCheck: true },
  SERIAL: { isSized: false, hasPrecision: false, hasCheck: true },
  BIGSERIAL: { isSized: false, hasPrecision: false, hasCheck: true },
  MONEY: { isSized: false, hasPrecision: true, hasCheck: true },
  CHAR: { isSized: true, hasPrecision: false, hasCheck: true, hasQuotes: true },
  VARCHAR: {
    isSized: true,
    hasPrecision: false,
    hasCheck: true,
    hasQuotes: true,
  },
  TEXT: { isSized: false, hasPrecision: false, hasCheck: true, hasQuotes: true },
  BYTEA: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  DATE: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  TIME: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  TIMETZ: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  TIMESTAMP: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  TIMESTAMPTZ: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  INTERVAL: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  BOOLEAN: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: false,
  },
  POINT: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: false },
  LINE: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: false },
  LSEG: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: false },
  BOX: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  PATH: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  POLYGON: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  CIRCLE: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  CIDR: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  INET: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  MACADDR: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  MACADDR8: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: true,
  },
  BIT: { isSized: true, hasPrecision: false, hasCheck: true, hasQuotes: false },
  VARBIT: {
    isSized: true,
    hasPrecision: false,
    hasCheck: true,
    hasQuotes: false,
  },
  VECTOR: { isSized: true, hasPrecision: false, hasCheck: true, hasQuotes: true },
  HALFVEC: { isSized: true, hasPrecision: false, hasCheck: true, hasQuotes: true },
  SPARSEVEC: {
    isSized: true,
    hasPrecision: false,
    hasCheck: true,
    hasQuotes: true,
  },
  TSVECTOR: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: false,
  },
  TSQUERY: {
    isSized: false,
    hasPrecision: false,
    hasCheck: false,
    hasQuotes: false,
  },
  JSON: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  JSONB: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  UUID: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
  XML: { isSized: false, hasPrecision: false, hasCheck: false, hasQuotes: true },
};

function getPostgresTypeMetadata(type: string): TypeMetadata | undefined {
  return postgresMetadata[type.toUpperCase()];
}

function quoteIdentifier(s: string): string {
  return `"${s}"`;
}

function isKeyword(str: string): boolean {
  const keywords = new Set([
    "NULL",
    "TRUE",
    "FALSE",
    "CURRENT_TIMESTAMP",
    "CURRENT_DATE",
    "CURRENT_TIME",
    "NOW",
  ]);
  return keywords.has(str.toUpperCase());
}

function isFunction(str: string): boolean {
  return /\w+\([^)]*\)$/.test(str);
}

function parseDefault(field: Field): string | number | boolean | undefined {
  if (typeof field.default !== "string") {
    return field.default;
  }

  const typeInfo = getPostgresTypeMetadata(field.fieldType.type);
  if (
    isFunction(field.default) ||
    isKeyword(field.default) ||
    (typeInfo && typeInfo.hasQuotes === false)
  ) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

function parseType(field: Field): string {
  let res = field.fieldType.type;

  const meta = getPostgresTypeMetadata(field.fieldType.type);
  if (meta?.isSized || meta?.hasPrecision) {
    res += fieldSizeSuffix(field.fieldType);
  }

  if ((field as { isArray?: boolean }).isArray) {
    res += " ARRAY";
  }

  return res;
}

function tablesToPostgres(diagram: Diagram): string {
  const enumStatements = diagram.enums
    .map(
      (e) =>
        `CREATE TYPE ${quoteIdentifier(e.name)} AS ENUM (\n${e.values
          .map((v) => `\t'${escapeQuotes(String(v))}'`)
          .join(",\n")}\n);\n`,
    )
    .join("\n");

  // TODO(spec §8): diagram.types materialisation is Postgres-only for now;
  // inline-vs-materialised custom types with provenance markers are a
  // follow-up phase.
  const typeStatements = diagram.types
    .map(
      (type) =>
        `CREATE TYPE ${quoteIdentifier(type.name)} AS (\n${type.fields
          .map((f) => `\t${quoteIdentifier(f.name)} ${f.type}`)
          .join(",\n")}\n);${
          type.comment?.trim()
            ? `\n\nCOMMENT ON TYPE ${quoteIdentifier(type.name)} IS '${escapeQuotes(type.comment)}';`
            : ""
        }`,
    )
    .join("\n\n");

  const tableStatements = diagram.tables
    .map((table) => {
      const inheritsClause =
        Array.isArray(table.inherits) && table.inherits.length > 0
          ? `\n) INHERITS (${table.inherits.map((parent) => quoteIdentifier(parent)).join(", ")})`
          : "\n)";

      const fieldDefinitions = table.fields
        .map(
          (field) =>
            `${exportLogicalNameComment(table, field)}${exportFieldComment(field.comment ?? "")}\t${quoteIdentifier(
              field.name,
            )} ${parseType(field)}${field.notNull ? " NOT NULL" : ""}${
              field.unique ? " UNIQUE" : ""
            }${field.increment ? " GENERATED BY DEFAULT AS IDENTITY" : ""}${
              String(field.default ?? "").trim()
                ? ` DEFAULT ${parseDefault(field)}`
                : ""
            }${
              field.check && getPostgresTypeMetadata(field.fieldType.type)?.hasCheck
                ? ` CHECK(${field.check})`
                : ""
            }`,
        )
        .join(",\n");

      const primaryKeyClause = table.fields.some((f) => f.primary)
        ? `,\n\tPRIMARY KEY(${table.fields
            .filter((f) => f.primary)
            .map((f) => quoteIdentifier(f.name))
            .join(", ")})`
        : "";

      const uniqueClause = uniqueConstraintClause(table, quoteIdentifier);

      const commentStatements = [
        table.comment?.trim()
          ? `COMMENT ON TABLE ${quoteIdentifier(table.name)} IS '${escapeQuotes(table.comment)}';`
          : "",
        ...table.fields.map((field) =>
          field.comment?.trim()
            ? `COMMENT ON COLUMN ${quoteIdentifier(table.name)}.${quoteIdentifier(field.name)} IS '${escapeQuotes(field.comment)}';`
            : "",
        ),
      ]
        .filter(Boolean)
        .join("\n");

      const indexStatements = (table.indices ?? [])
        .map(
          (i) =>
            `CREATE ${i.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(i.name)}\nON ${quoteIdentifier(table.name)} (${i.fields
              .map((f) =>
                quoteIdentifier(
                  table.fields.find((fl) => fl.id === f)?.name ?? String(f),
                ),
              )
              .join(", ")});`,
        )
        .join("\n");

      return [
        `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (\n${fieldDefinitions}${primaryKeyClause}${uniqueClause}${inheritsClause};`,
        commentStatements,
        indexStatements,
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");

  const foreignKeyStatements = diagram.relationships
    .map((r) => {
      const startTable = diagram.tables.find((t) => t.id === r.startTableId);
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);

      if (!startTable || !endTable) return "";

      const { startColumns, endColumns } = getFkColumnNames(
        r,
        startTable,
        endTable,
      );
      if (startColumns.some((c) => !c) || endColumns.some((c) => !c))
        return "";

      return `ALTER TABLE ${quoteIdentifier(startTable.name)}\nADD FOREIGN KEY(${startColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")}) REFERENCES ${quoteIdentifier(endTable.name)}(${endColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")})\nON UPDATE ${r.updateConstraint?.toUpperCase() ?? "NO ACTION"} ON DELETE ${r.deleteConstraint?.toUpperCase() ?? "NO ACTION"};`;
    })
    .filter(Boolean)
    .join("\n");

  return [enumStatements, typeStatements, tableStatements, foreignKeyStatements]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function toPostgres(diagram: Diagram): string {
  return appendViews(tablesToPostgres(diagram), diagram);
}
