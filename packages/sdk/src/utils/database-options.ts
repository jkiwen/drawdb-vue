import type { DatabaseType } from "@drawdb/core";

/**
 * The dialects the editor offers, in the order a reader looks for them.
 *
 * One list for the header and for the edit panel: the two places that switch
 * the dialect of a diagram must offer the same names (bug report of
 * 2026-10-29, where the panel could not switch at all).
 */
export const DATABASE_OPTIONS: { label: string; value: DatabaseType }[] = [
  { label: "MySQL", value: "mysql" },
  { label: "PostgreSQL", value: "postgres" },
  { label: "SQLite", value: "sqlite" },
  { label: "MariaDB", value: "mariadb" },
  { label: "Microsoft SQL Server", value: "mssql" },
  { label: "Oracle SQL", value: "oraclesql" },
  { label: "Generic", value: "generic" },
];
