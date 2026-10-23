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

const namesBody = order
  .map((db) => {
    const names = Object.keys(data[db])
      .map((n) => `    ${JSON.stringify(n)},`)
      .join("\n");
    return `  ${db}: [\n${names}\n  ],`;
  })
  .join("\n");

/** The kind of value a type accepts as a default. */
const NUMERIC_TYPES = new Set([
  "INT", "INT2", "INT4", "INT8", "INTEGER", "SMALLINT", "TINYINT",
  "MEDIUMINT", "BIGINT", "DECIMAL", "NUMERIC", "NUMBER", "FLOAT", "REAL",
  "DOUBLE", "DOUBLE PRECISION", "MONEY", "SERIAL", "SMALLSERIAL",
  "BIGSERIAL", "YEAR", "BIT",
]);

const BOOLEAN_TYPES = new Set(["BOOLEAN", "BOOL"]);

const DATE_TYPES = new Set([
  "DATE", "DATETIME", "DATETIME2", "DATETIMEOFFSET", "TIMESTAMP",
  "TIMESTAMPTZ", "TIME", "TIMETZ", "SMALLDATETIME", "DATETIME2 TZ",
]);

/**
 * The kind of default a type accepts.
 *
 * A type that cannot have a default at all is \`none\`; the other kinds are
 * derived from the name of the type.
 */
function classifyDefaultKind(name, flags) {
  if (flags.noDefault) return "none";
  const upper = name.toUpperCase();
  if (NUMERIC_TYPES.has(upper)) return "numeric";
  if (BOOLEAN_TYPES.has(upper)) return "boolean";
  if (DATE_TYPES.has(upper)) return "date";
  return "text";
}

const metadataBody = order
  .map((db) => {
    const entries = Object.entries(data[db]).map(([name, flags]) => {
      const parts = Object.entries(flags).map(
        ([k, v]) => `${k}: ${v ? "true" : "false"}`,
      );
      parts.push(`defaultKind: ${JSON.stringify(classifyDefaultKind(name, flags))}`);
      return `    ${JSON.stringify(name)}: { ${parts.join(", ")} },`;
    });
    return `  ${db}: {\n${entries.join("\n")}\n  },`;
  })
  .join("\n");

const out = `import type { DatabaseType } from "../models/diagram.ts";

/**
 * Canonical type names recognised by each database dialect.
 *
 * Generated from the React drawDB \`src/data/datatypes.js\` type tables by
 * \`scripts/generate-type-registry.mjs\`.
 */
export const DATABASE_TYPE_NAMES: Record<DatabaseType, readonly string[]> = {
${namesBody}
};

/**
 * The kind of value a type accepts as a default.
 *
 * - \`numeric\` — a number,
 * - \`boolean\` — true or false,
 * - \`date\` — a date or a timestamp,
 * - \`text\` — any text,
 * - \`none\` — the type cannot have a default at all.
 */
export type DefaultKind = "numeric" | "boolean" | "date" | "text" | "none";

/** Per-type capability flags carried over from the React drawDB type tables. */
export interface TypeMetadata {
  isSized?: boolean;
  hasPrecision?: boolean;
  hasQuotes?: boolean;
  canIncrement?: boolean;
  signed?: boolean;
  hasCheck?: boolean;
  noDefault?: boolean;
  defaultKind?: DefaultKind;
}

/**
 * Per-database type capability metadata.
 *
 * Generated from the React drawDB \`src/data/datatypes.js\` type tables by
 * \`scripts/generate-type-registry.mjs\`.
 */
export const DATABASE_TYPE_METADATA: Record<
  DatabaseType,
  Record<string, TypeMetadata>
> = {
${metadataBody}
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

/** Capability metadata for a type in a dialect, or undefined when unknown. */
export function getTypeMetadata(
  database: DatabaseType,
  type: string,
): TypeMetadata | undefined {
  return DATABASE_TYPE_METADATA[database]?.[String(type ?? "").toUpperCase()];
}

/**
 * True when the dialect type carries a size or precision argument, e.g.
 * \`VARCHAR(255)\` or \`DECIMAL(10,2)\`.
 */
export function typeTakesSize(
  type: string,
  database: DatabaseType,
): boolean {
  const meta = getTypeMetadata(database, type);
  return Boolean(meta && (meta.isSized || meta.hasPrecision));
}

const NUMERIC_TYPE_NAMES = new Set([
${[...NUMERIC_TYPES].map((n) => `  ${JSON.stringify(n)},`).join("\n")}
]);

const BOOLEAN_TYPE_NAMES = new Set([
${[...BOOLEAN_TYPES].map((n) => `  ${JSON.stringify(n)},`).join("\n")}
]);

const DATE_TYPE_NAMES = new Set([
${[...DATE_TYPES].map((n) => `  ${JSON.stringify(n)},`).join("\n")}
]);

/**
 * The kind of default a type accepts, derived from its name.
 *
 * Used for the types that the dialect tables do not know.
 */
export function classifyDefaultKind(
  type: string,
  noDefault = false,
): DefaultKind {
  if (noDefault) return "none";
  const upper = String(type ?? "").toUpperCase();
  if (NUMERIC_TYPE_NAMES.has(upper)) return "numeric";
  if (BOOLEAN_TYPE_NAMES.has(upper)) return "boolean";
  if (DATE_TYPE_NAMES.has(upper)) return "date";
  return "text";
}
`;

const target = path.join(root, "packages/core/src/types/registry.ts");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out);
console.log(`wrote ${path.relative(root, target)}`);
