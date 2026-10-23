import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import {
  escapeQuotes,
  exportFieldComment,
  getFkColumnNames,
  uniqueConstraintClause,
} from "./shared.ts";
import { appendViews } from "./views.ts";

interface OracleTypeMetadata {
  hasCheck?: boolean;
  hasQuotes?: boolean;
}

const oracleMetadata: Record<string, OracleTypeMetadata> = {
  INTEGER: { hasCheck: true },
  NUMBER: { hasCheck: true },
  FLOAT: { hasCheck: true },
  LONG: { hasCheck: true },
  VARCHAR2: { hasCheck: true, hasQuotes: true },
  NVARCHAR2: { hasCheck: true, hasQuotes: true },
  CHAR: { hasCheck: true, hasQuotes: true },
  NCHAR: { hasCheck: true, hasQuotes: true },
  CLOB: {},
  NCLOB: {},
  BLOB: {},
  BFILE: {},
  JSON: {},
  VECTOR: {},
  DATE: { hasQuotes: true },
  TIMESTAMP: { hasQuotes: true },
  INTERVAL: { hasQuotes: true },
  BOOLEAN: {},
  RAW: {},
};

function getTypeMetadata(type: string): OracleTypeMetadata | undefined {
  return oracleMetadata[type.toUpperCase()];
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
    "SYSDATE",
    "SYSTIMESTAMP",
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

  const meta = getTypeMetadata(field.type);
  if (
    isFunction(field.default) ||
    isKeyword(field.default) ||
    (meta && !meta.hasQuotes)
  ) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

function oracleDeleteClause(constraint?: string): string {
  switch (String(constraint).toLowerCase()) {
    case "cascade":
      return "\nON DELETE CASCADE";
    case "set null":
      return "\nON DELETE SET NULL";
    default:
      return "";
  }
}

function tablesToOracleSQL(diagram: Diagram): string {
  return `${diagram.tables
    .map(
      (table) =>
        `${
          table.comment === "" || table.comment == null
            ? ""
            : `/* ${table.comment} */\n`
        }CREATE TABLE ${quoteIdentifier(table.name)} (\n${table.fields
          .map(
            (field) =>
              `${exportFieldComment(field.comment ?? "")}\t${quoteIdentifier(
                field.name,
              )} ${field.type}${
                field.size !== undefined && field.size !== ""
                  ? "(" + field.size + ")"
                  : ""
              }${field.notNull ? " NOT NULL" : ""}${
                field.increment ? " GENERATED ALWAYS AS IDENTITY" : ""
              }${field.unique ? " UNIQUE" : ""}${
                field.default !== undefined && field.default !== ""
                  ? ` DEFAULT ${parseDefault(field)}`
                  : ""
              }${
                field.check === "" ||
                field.check == null ||
                !getTypeMetadata(field.type)?.hasCheck
                  ? ""
                  : ` CHECK(${field.check})`
              }`,
          )
          .join(",\n")}${
          table.fields.filter((f) => f.primary).length > 0
            ? `,\n\tPRIMARY KEY(${table.fields
                .filter((f) => f.primary)
                .map((f) => quoteIdentifier(f.name))
                .join(", ")})`
            : ""
        }${uniqueConstraintClause(table, quoteIdentifier)}\n);\n${
          table.indices?.length
            ? `\n${table.indices
                .map(
                  (i) =>
                    `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
                      i.name,
                    )}\nON ${quoteIdentifier(table.name)} (${i.fields
                      .map((f) => quoteIdentifier(f))
                      .join(", ")});`,
                )
                .join("")}`
            : ""
        }`,
    )
    .join("\n")}\n${diagram.relationships
    .map((r) => {
      const startTable = diagram.tables.find((t) => t.id === r.startTableId);
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      if (!startTable || !endTable) return "";
      const { startColumns, endColumns } = getFkColumnNames(
        r,
        startTable,
        endTable,
      );
      return `ALTER TABLE ${quoteIdentifier(startTable.name)}\nADD CONSTRAINT ${quoteIdentifier(
        r.name ?? `fk_${r.startTableId}_${r.endTableId}`,
      )} FOREIGN KEY (${startColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")}) REFERENCES ${quoteIdentifier(endTable.name)} (${endColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")})${oracleDeleteClause(r.deleteConstraint)};`;
    })
    .filter(Boolean)
    .join("\n")}`;
}

export function toOracleSql(diagram: Diagram): string {
  return appendViews(tablesToOracleSQL(diagram), diagram);
}
