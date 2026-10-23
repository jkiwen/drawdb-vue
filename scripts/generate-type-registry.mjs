// Generates `packages/core/src/types/registry.ts` from the extracted JSON
// type tables. Re-run with: node scripts/generate-type-registry.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(here, "types-extracted.json"), "utf8"),
);

const order = ["generic", "mysql", "mariadb", "postgres", "sqlite", "mssql", "oraclesql"];

const body = order
  .map((db) => {
    const names = data[db]
      .map((n) => `    ${JSON.stringify(n)},`)
      .join("\n");
    return `  ${db}: [\n${names}\n  ],`;
  })
  .join("\n");

const out = `import type { DatabaseType } from "../models/diagram.ts";

/**
 * Canonical type names recognised by each database dialect.
 *
 * Generated from the React drawDB \`src/data/datatypes.js\` type tables by
 * \`scripts/generate-type-registry.mjs\`. Only the type NAMES are carried
 * over here; the richer per-type metadata (colour, default checks, sizing
 * rules) is delivered by the metadata system in a later task.
 */
export const DATABASE_TYPE_NAMES: Record<DatabaseType, readonly string[]> = {
${body}
};

/**
 * Fallback type used when a parsed type is not recognised by the dialect.
 * Mirrors the affinity tables used by the React importer.
 */
export const FALLBACK_TYPE = "BLOB";

const TYPE_NAME_SETS: Record<DatabaseType, ReadonlySet<string>> = {
${order
  .map((db) => `  ${db}: new Set(DATABASE_TYPE_NAMES.${db}),`)
  .join("\n")}
};

/** Type affinity applied when a parsed type is unknown to the dialect. */
export const TYPE_AFFINITY: Record<DatabaseType, Record<string, string>> = {
  generic: {
    INTEGER: "INT",
    TINYINT: "SMALLINT",
    MEDIUMINT: "INTEGER",
    BIT: "BOOLEAN",
    YEAR: "INTEGER",
  },
  mysql: {
    INT: "INTEGER",
  },
  mariadb: {
    INT: "INTEGER",
  },
  postgres: {
    INT: "INTEGER",
    INT2: "SMALLINT",
    INT4: "INTEGER",
    INT8: "BIGINT",
  },
  sqlite: {
    INT: "INTEGER",
    INT2: "SMALLINT",
  },
  mssql: {
    INT: "INTEGER",
  },
  oraclesql: {
    INT: "INTEGER",
    INT2: "SMALLINT",
    NUMBER: "NUMBER",
  },
};

/** True when \`type\` is a known type name for \`database\` (case-insensitive). */
export function isKnownTypeName(database: DatabaseType, type: string): boolean {
  const set = TYPE_NAME_SETS[database];
  if (!set) return false;
  return set.has(String(type).toUpperCase());
}

/**
 * Resolve the canonical type name for a parsed SQL type.
 * Unknown types fall back to the dialect affinity table, then to
 * \`FALLBACK_TYPE\`.
 */
export function canonicalTypeName(
  database: DatabaseType,
  type: string,
): string {
  const raw = String(type ?? "").toUpperCase();
  if (isKnownTypeName(database, raw)) return raw;
  const affinity = TYPE_AFFINITY[database] ?? {};
  return affinity[raw] ?? FALLBACK_TYPE;
}
`;

const target = path.join(root, "packages/core/src/types/registry.ts");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out);
console.log(`wrote ${path.relative(root, target)}`);
