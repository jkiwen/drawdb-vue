import type { Diagram } from "../models/diagram.ts";
import { toMariadb } from "./mariadb.ts";
import { toMySQL } from "./mysql.ts";
import { toPostgres } from "./postgres.ts";
import { toSqlite } from "./sqlite.ts";

export * from "./dialect-meta.ts";
export * from "./shared.ts";
export * from "./views.ts";
export * from "./mysql.ts";
export * from "./postgres.ts";
export * from "./mariadb.ts";
export * from "./sqlite.ts";

export type SQLDialect =
  | "mysql"
  | "postgres"
  | "sqlite"
  | "mariadb"
  | "mssql"
  | "oraclesql"
  | "generic";

export function exportSQL(diagram: Diagram): string {
  const sql = schemaSQL(diagram);
  const header = diagram.sqlHeader?.trim();
  return header ? `${header}\n\n${sql}` : sql;
}

function schemaSQL(diagram: Diagram): string {
  switch (diagram.database) {
    case "mysql":
      return toMySQL(diagram);
    case "postgres":
      return toPostgres(diagram);
    case "sqlite":
      return toSqlite(diagram);
    case "mariadb":
      return toMariadb(diagram);
    case "mssql":
    case "oraclesql":
    case "generic":
    default:
      throw new Error(
        `SQL export for database "${diagram.database}" is not yet implemented.`,
      );
  }
}
