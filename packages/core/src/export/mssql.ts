import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import { appendViews } from "./views.ts";
import {
  escapeQuotes,
  getFkColumnNames,
  uniqueConstraintClause,
} from "./shared.ts";

interface MssqlTypeMetadata {
  isSized?: boolean;
  hasPrecision?: boolean;
  hasCheck?: boolean;
  hasQuotes?: boolean;
}

const mssqlMetadata: Record<string, MssqlTypeMetadata> = {
  TINYINT: { hasCheck: true },
  SMALLINT: { hasCheck: true },
  INTEGER: { hasCheck: true },
  BIGINT: { hasCheck: true },
  BIT: { hasCheck: true, hasPrecision: true },
  DECIMAL: { hasCheck: true, hasPrecision: true },
  NUMERIC: { hasCheck: true, hasPrecision: true },
  FLOAT: { hasCheck: true, hasPrecision: true },
  DOUBLE: { hasCheck: true, hasPrecision: true },
  REAL: { hasCheck: true },
  MONEY: { hasCheck: true, hasPrecision: true },
  SMALLMONEY: { hasCheck: true, hasPrecision: true },
  DATE: { hasQuotes: true },
  DATETIME: { hasQuotes: true },
  DATETIME2: { hasPrecision: true, hasQuotes: true },
  DATETIMEOFFSET: { hasPrecision: true, hasQuotes: true },
  SMALLDATETIME: { hasQuotes: true },
  TIME: { hasQuotes: true },
  TIMESTAMP: { hasQuotes: true },
  CHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  VARCHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  TEXT: { isSized: true, hasQuotes: true },
  NCHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  NVARCHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  NTEXT: { isSized: true, hasQuotes: true },
  BINARY: { isSized: true, hasQuotes: true },
  VARBINARY: { isSized: true, hasQuotes: true },
  IMAGE: { hasQuotes: true },
  UNIQUEIDENTIFIER: {},
  XML: { hasQuotes: true },
  CURSOR: {},
  SQL_VARIANT: {},
  JSON: { hasQuotes: true },
};

function getTypeMetadata(type: string): MssqlTypeMetadata | undefined {
  return mssqlMetadata[type.toUpperCase()];
}

function quoteIdentifier(s: string): string {
  return `[${s}]`;
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

function parseType(field: Field): string {
  const meta = getTypeMetadata(field.type);
  const supportsSize = meta?.isSized || meta?.hasPrecision;
  const size =
    field.size && field.size !== "" && supportsSize ? `(${field.size})` : "";
  return `${field.type}${size}`;
}

function generateAddExtendedPropertySQL(
  value: string | undefined,
  level1name: string,
  level2name: string | null = null,
): string {
  if (!value || value.trim() === "") {
    return "";
  }

  const escapedValue = escapeQuotes(value.replace(/\n/g, " "));
  const escapedTableName = escapeQuotes(level1name);

  if (level2name) {
    const escapedColumnName = escapeQuotes(level2name);
    return `
EXEC sys.sp_addextendedproperty
    @name=N'MS_Description', @value=N'${escapedValue}',
    @level0type=N'SCHEMA',@level0name=N'dbo',
    @level1type=N'TABLE',@level1name=N'${escapedTableName}',
    @level2type=N'COLUMN',@level2name=N'${escapedColumnName}';
GO
`;
  }

  return `
EXEC sys.sp_addextendedproperty
    @name=N'MS_Description', @value=N'${escapedValue}',
    @level0type=N'SCHEMA',@level0name=N'dbo',
    @level1type=N'TABLE',@level1name=N'${escapedTableName}';
GO
`;
}

function tablesToMssql(diagram: Diagram): string {
  const tablesSql = diagram.tables
    .map((table) => {
      const fieldsSql = table.fields
        .map((field) => {
          const meta = getTypeMetadata(field.type);
          return `\t${quoteIdentifier(field.name)} ${parseType(field)}${
            field.notNull ? " NOT NULL" : ""
          }${field.increment ? " IDENTITY" : ""}${
            field.unique ? " UNIQUE" : ""
          }${
            field.default !== undefined && field.default !== ""
              ? ` DEFAULT ${parseDefault(field)}`
              : ""
          }${
            !field.check ||
            field.check === "" ||
            !meta?.hasCheck
              ? ""
              : ` CHECK(${field.check})`
          }`;
        })
        .join(",\n");

      const primaryKeys = table.fields.filter((f) => f.primary);
      const primaryKeySql =
        primaryKeys.length > 0
          ? `,\n\tPRIMARY KEY(${primaryKeys
              .map((f) => quoteIdentifier(f.name))
              .join(", ")})`
          : "";

      const uniqueSql = uniqueConstraintClause(table, quoteIdentifier);

      const createTableSql = `CREATE TABLE ${quoteIdentifier(table.name)} (\n${fieldsSql}${primaryKeySql}${uniqueSql}\n);\nGO\n`;

      const tableCommentSql = generateAddExtendedPropertySQL(
        table.comment,
        table.name,
      );

      const columnCommentsSql = table.fields
        .map((field) =>
          generateAddExtendedPropertySQL(field.comment, table.name, field.name),
        )
        .join("");

      const indicesSql = (table.indices ?? [])
        .map(
          (i) =>
            `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
              i.name,
            )}\nON ${quoteIdentifier(table.name)} (${i.fields
              .map((f) => quoteIdentifier(f))
              .join(", ")});\nGO\n`,
        )
        .join("");

      return `${createTableSql}${tableCommentSql}${columnCommentsSql}${indicesSql}`;
    })
    .join("\n");

  const relationshipsSql = diagram.relationships
    .map((r) => {
      const startTable = diagram.tables.find((t) => t.id === r.startTableId);
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      if (!startTable || !endTable) return "";

      const { startColumns, endColumns } = getFkColumnNames(
        r,
        startTable,
        endTable,
      );
      if (startColumns.some((c) => !c) || endColumns.some((c) => !c)) {
        return "";
      }

      return `\nALTER TABLE ${quoteIdentifier(startTable.name)}\nADD FOREIGN KEY(${startColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")}) REFERENCES ${quoteIdentifier(endTable.name)}(${endColumns
        .map((c) => quoteIdentifier(String(c)))
        .join(", ")})\nON UPDATE ${r.updateConstraint?.toUpperCase() ?? "NO ACTION"} ON DELETE ${r.deleteConstraint?.toUpperCase() ?? "NO ACTION"};\nGO`;
    })
    .filter(Boolean)
    .join("");

  return `${tablesSql}\n${relationshipsSql}`;
}

export function toMssql(diagram: Diagram): string {
  return appendViews(tablesToMssql(diagram), diagram);
}
