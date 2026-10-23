import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { TypeMetadata } from "./dialect-meta.ts";
import {
  escapeQuotes,
  exportFieldComment,
  getInlineFK,
  uniqueConstraintClause,
} from "./shared.ts";
import { appendViews } from "./views.ts";

const sqliteMetadata: Record<string, TypeMetadata | undefined> = {
  INTEGER: { hasCheck: true },
  REAL: { hasCheck: true },
  NUMERIC: { hasCheck: true },
  BOOLEAN: {},
  VARCHAR: { hasCheck: true, hasQuotes: true },
  TEXT: { hasCheck: true, hasQuotes: true },
  BLOB: {},
  TIME: { hasQuotes: true },
  TIMESTAMP: { hasQuotes: true },
  DATE: { hasQuotes: true },
  DATETIME: { hasQuotes: true },
};

function quoteIdentifier(s: string): string {
  return `"${s}"`;
}

function getSqliteTypeMetadata(type: string): TypeMetadata | undefined {
  return sqliteMetadata[type.toUpperCase()];
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

  const typeInfo = getSqliteTypeMetadata(field.type);
  if (
    isFunction(field.default) ||
    isKeyword(field.default) ||
    (typeInfo && !typeInfo.hasQuotes)
  ) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

function tablesToSqlite(diagram: Diagram): string {
  return diagram.tables
    .map((table) => {
      const inlineFK = getInlineFK(table, diagram, quoteIdentifier);
      return `${
        table.comment?.trim() ? `/* ${table.comment} */\n` : ""
      }CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (\n${table.fields
        .map(
          (field) =>
            `${exportFieldComment(field.comment ?? "")}\t${quoteIdentifier(
              field.name,
            )} ${field.type}${field.notNull ? " NOT NULL" : ""}${
              field.unique ? " UNIQUE" : ""
            }${
              field.default !== undefined && field.default !== ""
                ? ` DEFAULT ${parseDefault(field)}`
                : ""
            }${
              field.check === "" ||
              field.check == null ||
              !getSqliteTypeMetadata(field.type)?.hasCheck
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
      }${inlineFK !== "" ? ",\n" : ""}${inlineFK}${uniqueConstraintClause(
        table,
        quoteIdentifier,
      )}\n);\n${(table.indices ?? [])
        .map(
          (i) =>
            `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quoteIdentifier(
              i.name,
            )}\nON ${quoteIdentifier(table.name)} (${i.fields
              .map((f) => quoteIdentifier(f))
              .join(", ")});`,
        )
        .join("\n")}`;
    })
    .join("\n");
}

export function toSqlite(diagram: Diagram): string {
  return appendViews(tablesToSqlite(diagram), diagram);
}
