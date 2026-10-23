import type { DatabaseType } from "../../models/diagram.ts";
import type { Field } from "../../models/field.ts";
import type { Relationship } from "../../models/relationship.ts";
import type { Table } from "../../models/table.ts";

/** Loosely typed node-sql-parser AST node. */
export type ASTNode = Record<string, any>;

/**
 * The result every SQL importer produces: the tables it recognised and the
 * relationships between them.
 */
export interface ImportedDiagramFragment {
  tables: Table[];
  relationships: Relationship[];
}

const IDENTIFIER_QUOTES: Record<DatabaseType, [string, string]> = {
  mysql: ["`", "`"],
  mariadb: ["`", "`"],
  postgres: ['"', '"'],
  sqlite: ['"', '"'],
  mssql: ["[", "]"],
  oraclesql: ['"', '"'],
  generic: ['"', '"'],
};

/** Quote an identifier using the convention of the given dialect. */
export function quoteColumn(value: string, database: DatabaseType): string {
  const [open, close] = IDENTIFIER_QUOTES[database] ?? ['"', '"'];
  return `${open}${value}${close}`;
}

/**
 * Find the table a foreign key points at, preferring the table currently
 * being created (self references) over the already parsed tables.
 */
export function findReferencedTable(
  tables: Table[],
  currentTable: Table,
  name: string,
): Table | undefined {
  if (currentTable.name === name) return currentTable;
  return tables.find((table) => table.name === name);
}

/** Upper-case the first letter, used for referential action names. */
export function capitalize(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.substring(1);
}

/**
 * Rebuild a SQL fragment from a node-sql-parser expression node.
 * Used for CHECK constraints and column defaults that reference functions.
 */
export function buildSQLFromAST(ast: ASTNode, database: DatabaseType): string {
  if (!ast) return "";

  if (ast.type === "binary_expr") {
    const leftSQL = buildSQLFromAST(ast.left, database);
    const rightSQL = buildSQLFromAST(ast.right, database);
    return `${leftSQL} ${ast.operator} ${rightSQL}`;
  }

  if (ast.type === "function") {
    let expr = ast.name;
    if (ast.args) {
      expr +=
        "(" +
        ast.args.value
          .map((v: ASTNode) => {
            if (v.type === "column_ref") return "`" + v.column + "`";
            if (
              v.type === "single_quote_string" ||
              v.type === "double_quote_string"
            ) {
              return "'" + v.value + "'";
            }
            return v.value;
          })
          .join(", ") +
        ")";
    }
    return expr;
  }

  if (ast.type === "column_ref") {
    return quoteColumn(ast.column, database);
  }

  if (ast.type === "expr_list") {
    return ast.value.map((v: ASTNode) => v.value).join(" AND ");
  }

  return typeof ast.value === "string" ? "'" + ast.value + "'" : ast.value;
}

/**
 * Read the literal default value of a column definition.
 * Functions are rendered as `NAME(args)`, `NULL` is kept as text.
 */
export function readDefaultValue(node: ASTNode | undefined): string {
  if (!node) return "";

  const value = node.value;
  if (!value) return "";

  if (value.type === "function") {
    let defaultValue = "";
    const nameNode = value.name;
    defaultValue = Array.isArray(nameNode?.name)
      ? nameNode.name[0]?.value ?? ""
      : nameNode?.name ?? nameNode?.value ?? "";
    if (value.args) {
      defaultValue +=
        "(" +
        value.args.value
          .map((v: ASTNode) => {
            if (
              v.type === "single_quote_string" ||
              v.type === "double_quote_string"
            ) {
              return "'" + v.value + "'";
            }
            return v.value;
          })
          .join(", ") +
        ")";
    }
    return defaultValue;
  }

  if (value.type === "null") return "NULL";
  if (value.value === undefined || value.value === null) return "";
  return String(value.value);
}

/** Find a field on a table by its column name. */
export function findFieldByName(
  fields: Field[],
  name: string,
): Field | undefined {
  return fields.find((field) => field.name === name);
}
