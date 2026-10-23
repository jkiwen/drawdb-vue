import nodeSqlParser from "node-sql-parser";
import oracleSqlParser from "oracle-sql-parser";
import type { DatabaseType } from "../../models/diagram.ts";
import { parseMSSQL } from "./mssql-parser.ts";
import type { ASTNode } from "./shared.ts";

const { Parser: SqlParser } = nodeSqlParser;
const { Parser: OracleParser } = oracleSqlParser;

/** node-sql-parser dialect names, keyed by our DatabaseType. */
const PARSER_DIALECTS: Record<DatabaseType, string> = {
  mysql: "mysql",
  mariadb: "mariadb",
  postgres: "postgresql",
  sqlite: "sqlite",
  mssql: "transactsql",
  oraclesql: "oracle",
  generic: "mysql",
};

const SUPPORTED_DATABASES = Object.keys(PARSER_DIALECTS) as DatabaseType[];

/** Error raised when SQL cannot be parsed into a diagram. */
export class SQLImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SQLImportError";
  }
}

/** True when the given database has a dedicated SQL parser. */
export function isSupportedDatabase(database: string): database is DatabaseType {
  return SUPPORTED_DATABASES.includes(database as DatabaseType);
}

/**
 * Parse a SQL script into a list of node-sql-parser AST statements.
 *
 * @throws {SQLImportError} when the database is unsupported or the SQL cannot
 * be parsed. The parser error message and location are preserved so the UI
 * can point at the offending statement.
 */
export function parseSQL(sql: string, database: DatabaseType): ASTNode[] {
  if (!isSupportedDatabase(database)) {
    throw new SQLImportError(
      `Unsupported database "${database}" for SQL import. Supported databases: ${SUPPORTED_DATABASES.join(", ")}.`,
    );
  }

  const source = String(sql ?? "").trim();
  if (!source) return [];

  try {
    if (database === "oraclesql") {
      const parser = new OracleParser();
      const ast = parser.parse(source);
      return (Array.isArray(ast) ? ast : [ast]) as ASTNode[];
    }

    // The `transactsql` grammar of node-sql-parser cannot express foreign
    // keys, so SQL Server scripts are parsed by the dedicated T-SQL parser.
    if (database === "mssql") {
      return parseMSSQL(source);
    }

    const parser = new SqlParser();
    const ast = parser.astify(source, {
      database: PARSER_DIALECTS[database],
    });
    return Array.isArray(ast) ? ast : [ast];
  } catch (error) {
    const location = (error as { location?: { start?: { line?: number; column?: number } } })
      ?.location;
    const where = location?.start?.line
      ? ` at line ${location.start.line}, column ${location.start.column}`
      : "";
    throw new SQLImportError(
      `Failed to parse SQL for database "${database}"${where}: ${(error as Error)?.message ?? String(error)}`,
      { cause: error },
    );
  }
}
