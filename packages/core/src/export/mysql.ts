import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import { getTypeMetadata } from "./dialect-meta.ts";
import {
  escapeQuotes,
  getFkColumnNames,
  parseDefault,
  uniqueConstraintClause,
} from "./shared.ts";
import { appendViews } from "./views.ts";

function quoteIdentifier(s: string): string {
  return `\`${s}\``;
}

function parseType(field: Field): string {
  let res = field.type;

  if (field.type === "SET" || field.type === "ENUM") {
    res += `${field.values ? "(" + field.values.map((value) => "'" + escapeQuotes(String(value)) + "'").join(", ") + ")" : ""}`;
  }

  const meta = getTypeMetadata("mysql", field.type);
  if (meta?.isSized || meta?.hasPrecision) {
    res += `${field.size && field.size !== "" ? "(" + field.size + ")" : ""}`;
  }

  return res;
}

function tablesToMySQL(diagram: Diagram): string {
  return `${diagram.tables
    .map(
      (table) =>
        `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (\n${table.fields
          .map(
            (field) =>
              `\t${quoteIdentifier(field.name)} ${parseType(field)}${
                getTypeMetadata("mysql", field.type)?.signed && field.unsigned
                  ? " UNSIGNED"
                  : ""
              }${field.notNull ? " NOT NULL" : ""}${
                field.increment ? " AUTO_INCREMENT" : ""
              }${field.unique ? " UNIQUE" : ""}${
                field.default !== undefined && field.default !== ""
                  ? ` DEFAULT ${parseDefault(field, "mysql")}`
                  : ""
              }${
                field.check === "" ||
                field.check == null ||
                !getTypeMetadata("mysql", field.type)?.hasCheck
                  ? ""
                  : ` CHECK(${field.check})`
              }${field.comment ? ` COMMENT '${escapeQuotes(field.comment)}'` : ""}`,
          )
          .join(",\n")}${
          table.fields.filter((f) => f.primary).length > 0
            ? `,\n\tPRIMARY KEY(${table.fields
                .filter((f) => f.primary)
                .map((f) => quoteIdentifier(f.name))
                .join(", ")})`
            : ""
        }${uniqueConstraintClause(table, quoteIdentifier)}\n)${table.comment ? ` COMMENT='${escapeQuotes(table.comment)}'` : ""};\n${table.indices?.length ? `\n${table.indices
          .map(
            (i) =>
              `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
                i.name,
              )}\nON ${quoteIdentifier(table.name)} (${i.fields
                .map((f) => quoteIdentifier(f))
                .join(", ")});`,
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

export function toMySQL(diagram: Diagram): string {
  return appendViews(tablesToMySQL(diagram), diagram);
}
