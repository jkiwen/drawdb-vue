import type { Diagram } from "../models/diagram.ts";
import { toMySQL } from "./mysql.ts";

export * from "./dialect-meta.ts";
export * from "./shared.ts";
export * from "./views.ts";
export * from "./mysql.ts";

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
    case "sqlite":
    case "mariadb":
    case "mssql":
    case "oraclesql":
    case "generic":
    default:
      throw new Error(
        `SQL export for database "${diagram.database}" is not yet implemented.`,
      );
  }
}
