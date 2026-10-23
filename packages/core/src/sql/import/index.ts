import type { DatabaseType, Diagram } from "../../models/diagram.ts";
import { createEmptyDiagram } from "../../models/diagram.ts";
import { arrangeTables } from "../../utils/arrange-tables.ts";
import { createId } from "../../utils/id.ts";
import { fromMariaDB } from "./mariadb.ts";
import { fromMSSQL } from "./mssql.ts";
import { fromMySQL } from "./mysql.ts";
import { fromOracleSQL } from "./oraclesql.ts";
import { fromPostgres } from "./postgres.ts";
import { fromSQLite } from "./sqlite.ts";
import { parseSQL } from "./parser.ts";
import type { ASTNode } from "./shared.ts";

export * from "./parser.ts";
export * from "./shared.ts";
export * from "./mysql.ts";
export * from "./mariadb.ts";
export * from "./postgres.ts";
export * from "./sqlite.ts";
export * from "./mssql.ts";
export * from "./oraclesql.ts";

export interface ImportSQLOptions {
  /** Database the resulting diagram targets. Defaults to the source dialect. */
  targetDatabase?: DatabaseType;
  /** Title of the resulting diagram. */
  title?: string;
}

type FragmentImporter = (
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType,
) => { tables: Diagram["tables"]; relationships: Diagram["relationships"] };

/**
 * Import a SQL script into a diagram.
 *
 * @param sql - The SQL script to import.
 * @param database - The dialect the SQL is written in.
 * @throws {SQLImportError} when the SQL cannot be parsed.
 */
export function importSQL(
  sql: string,
  database: DatabaseType,
  options: ImportSQLOptions = {},
): Diagram {
  const ast = parseSQL(sql, database);
  const targetDatabase = options.targetDatabase ?? database;

  const importer = selectImporter(database);
  const fragment = importer(ast, targetDatabase);

  const diagram = createEmptyDiagram({
    database: targetDatabase,
    title: options.title ?? "",
    id: createId(),
  });

  diagram.tables = fragment.tables;
  diagram.relationships = fragment.relationships;

  arrangeTables(diagram.tables);

  return diagram;
}

/**
 * Pick the importer for a dialect.
 *
 * The `generic` dialect has no grammar of its own, so portable SQL is read
 * with the MySQL grammar, which accepts the common subset.
 */
function selectImporter(database: DatabaseType): FragmentImporter {
  switch (database) {
    case "mysql":
      return fromMySQL;
    case "mariadb":
      return fromMariaDB;
    case "postgres":
      return fromPostgres;
    case "sqlite":
      return fromSQLite;
    case "mssql":
      return fromMSSQL;
    case "oraclesql":
      return fromOracleSQL;
    case "generic":
      return fromMySQL;
    default:
      throw new Error(`Unsupported database "${database}" for SQL import.`);
  }
}
