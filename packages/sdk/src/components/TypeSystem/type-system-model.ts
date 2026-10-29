import type { DatabaseType, LogicalTypeFamily } from "@drawdb/core";

/** The order the DSM shows the dialects in: the ones people pick first. */
export const DIALECTS: readonly DatabaseType[] = [
  "mysql",
  "postgres",
  "sqlite",
  "mariadb",
  "mssql",
  "oraclesql",
  "generic",
];

/** The dialect names as they read in the editor. */
export const DIALECT_LABELS: Record<DatabaseType, string> = {
  mysql: "MySQL",
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  mariadb: "MariaDB",
  mssql: "SQL Server",
  oraclesql: "Oracle SQL",
  generic: "Generic",
};

/**
 * The parameters a family of the mapping editor exposes for one dialect. It is
 * derived from the parameters the family declares, so a family that cannot
 * express a size does not show a length input at all.
 */
export interface MappingParams {
  length: boolean;
  precision: boolean;
  scale: boolean;
}

export function mappingParamsOf(family: LogicalTypeFamily): MappingParams {
  const keys = new Set(family.params.map((param) => param.key));
  return {
    length: keys.has("length"),
    precision: keys.has("precision"),
    scale: keys.has("scale"),
  };
}

/** The display label of a family: its i18n key, or its id for a custom one. */
export function familyKey(family: LogicalTypeFamily): string {
  return `type_family.${family.id}`;
}

/** True when a dialect's mapping of the family exists (a known gap otherwise). */
export function isMapped(family: LogicalTypeFamily, database: DatabaseType): boolean {
  return Boolean(family.mappings[database]);
}
