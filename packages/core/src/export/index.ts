import type { Diagram } from "../models/diagram.ts";
import { toGeneric } from "./generic.ts";
import { toMariadb } from "./mariadb.ts";
import { toMssql } from "./mssql.ts";
import { toMySQL } from "./mysql.ts";
import { toOracleSql } from "./oraclesql.ts";
import { toPostgres } from "./postgres.ts";
import { toSqlite } from "./sqlite.ts";

export * from "./dialect-meta.ts";
export * from "./shared.ts";
export * from "./views.ts";
export * from "./mysql.ts";
export * from "./postgres.ts";
export * from "./mariadb.ts";
export * from "./sqlite.ts";
export * from "./mssql.ts";
export * from "./oraclesql.ts";
export * from "./generic.ts";

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
      return toMssql(diagram);
    case "oraclesql":
      return toOracleSql(diagram);
    case "generic":
      return toGeneric(diagram);
    default:
      throw new Error(
        `SQL export for database "${diagram.database}" is not yet implemented.`,
      );
  }
}
