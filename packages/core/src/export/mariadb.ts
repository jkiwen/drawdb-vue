import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { TypeMetadata } from "./dialect-meta.ts";
import {
  escapeQuotes,
  exportLogicalNameComment,
  fieldSizeSuffix,
  getFkColumnNames,
  indexColumnList,
  parseDefault,
  primaryKeyFragment,
  uniqueConstraintClause,
} from "./shared.ts";
import { appendViews } from "./views.ts";

const mariadbMetadata: Record<string, TypeMetadata | undefined> = {
  INT: { isSized: true, hasCheck: true, signed: true },
  BIGINT: { isSized: true, hasCheck: true, signed: true },
  SMALLINT: { isSized: true, hasCheck: true, signed: true },
  TINYINT: { isSized: true, hasCheck: true, signed: true },
  MEDIUMINT: { isSized: true, hasCheck: true, signed: true },
  VARCHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  CHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  TEXT: { hasCheck: true, hasQuotes: true },
  MEDIUMTEXT: { hasCheck: true, hasQuotes: true },
  LONGTEXT: { hasCheck: true, hasQuotes: true },
  TIMESTAMP: { hasCheck: true },
  DATETIME: { hasCheck: true },
  DATE: { hasCheck: true },
  TIME: { hasCheck: true },
  YEAR: { hasCheck: true },
  DECIMAL: { isSized: true, hasPrecision: true, hasCheck: true, signed: true },
  NUMERIC: { isSized: true, hasPrecision: true, hasCheck: true, signed: true },
  FLOAT: { isSized: true, hasCheck: true, signed: true },
  DOUBLE: { isSized: true, hasCheck: true, signed: true },
  BOOLEAN: { hasCheck: true },
  BIT: { isSized: true, hasCheck: true },
  BINARY: { isSized: true, hasCheck: true },
  VARBINARY: { isSized: true, hasCheck: true },
  BLOB: { hasCheck: true },
  ENUM: { hasCheck: true, hasQuotes: true },
  SET: { hasCheck: true, hasQuotes: true },
  JSON: { hasCheck: true },
};

function quoteIdentifier(s: string): string {
  return `\`${s}\``;
}

function getMariadbTypeMetadata(type: string): TypeMetadata | undefined {
  return mariadbMetadata[type.toUpperCase()];
}

function parseType(field: Field): string {
  let res = field.fieldType.type;

  if (field.fieldType.type === "SET" || field.fieldType.type === "ENUM") {
    res += `${field.values ? "(" + field.values.map((value) => "'" + escapeQuotes(String(value)) + "'").join(", ") + ")" : ""}`;
  }

  const meta = getMariadbTypeMetadata(field.fieldType.type);
  if (meta?.isSized || meta?.hasPrecision) {
    res += fieldSizeSuffix(field.fieldType);
  }

  return res;
}

function tablesToMariaDB(diagram: Diagram): string {
  return `${diagram.tables
    .map(
      (table) =>
        `CREATE OR REPLACE TABLE ${quoteIdentifier(table.name)} (\n${table.fields
          .map(
            (field) =>
              `${exportLogicalNameComment(table, field)}\t${quoteIdentifier(field.name)} ${parseType(field)}${
                field.unsigned ? " UNSIGNED" : ""
              }${field.notNull ? " NOT NULL" : ""}${
                field.increment ? " AUTO_INCREMENT" : ""
              }${field.unique ? " UNIQUE" : ""}${
                field.default !== undefined && field.default !== ""
                  ? ` DEFAULT ${parseDefault(field, "mysql")}`
                  : ""
              }${
                field.check === "" ||
                field.check == null ||
                !getMariadbTypeMetadata(field.fieldType.type)?.hasCheck
                  ? ""
                  : ` CHECK(${field.check})`
              }${field.comment ? ` COMMENT '${escapeQuotes(field.comment)}'` : ""}`,
          )
          .join(",\n")}${primaryKeyFragment(table, quoteIdentifier)}${uniqueConstraintClause(table, quoteIdentifier)}\n)${table.comment ? ` COMMENT='${escapeQuotes(table.comment)}'` : ""};\n${table.indices?.length ? `\n${table.indices
          .map(
            (i) =>
              `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
                i.name,
              )}\nON ${quoteIdentifier(table.name)} (${indexColumnList(table, i, quoteIdentifier)});`,
          )
          .join("")}` : ""}`,
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
      return `ALTER TABLE ${quoteIdentifier(startTable.name)}\nADD FOREIGN KEY(${startColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")}) REFERENCES ${quoteIdentifier(endTable.name)}(${endColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")})\nON UPDATE ${r.updateConstraint?.toUpperCase() ?? "NO ACTION"} ON DELETE ${r.deleteConstraint?.toUpperCase() ?? "NO ACTION"};`;
    })
    .filter(Boolean)
    .join("\n")}`;
}

export function toMariadb(diagram: Diagram): string {
  return appendViews(tablesToMariaDB(diagram), diagram);
}
