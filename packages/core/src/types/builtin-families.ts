import type {
  BuiltinFamilyId,
  LogicalTypeFamily,
  TypeMapping,
} from "./family.ts";
import type { DatabaseType } from "../models/diagram.ts";

/**
 * The default physical mappings of the builtin logical type families
 * (spec section 3.2). The shape is 11 families x 7 dialects = 77 entries;
 * builtin families must be exhaustive (D1) and every target type must be a
 * name the target dialect whitelist knows (guarded by
 * builtin-families.test.ts).
 *
 * The table is data, not code: never branch on family ids here; resolution
 * rules live in `resolve.ts` (P2).
 */

function param(key: "length" | "precision" | "scale", label: string) {
  return { key, label };
}

function m(
  type: string,
  params?: { length?: number; precision?: number; scale?: number },
  flags?: { unicode?: boolean; unsigned?: boolean; autoincrement?: boolean },
): TypeMapping {
  return { type, ...(params ? { params } : {}), ...(flags ? { flags } : {}) };
}

function row(
  generic: TypeMapping,
  mysql: TypeMapping,
  postgres: TypeMapping,
  sqlite: TypeMapping,
  mssql: TypeMapping,
  oraclesql: TypeMapping,
  mariadb: TypeMapping,
): Record<DatabaseType, TypeMapping> {
  return { generic, mysql, postgres, sqlite, mssql, oraclesql, mariadb };
}

export const BUILTIN_FAMILIES: LogicalTypeFamily[] = [
  {
    id: "string",
    label: "type_family.string",
    params: [param("length", "type_param.length")],
    // The 255 default lives in each mapping row (spec §4.1: family
    // defaultParams are a scope-override level above mapping params; putting
    // the builtin default there would make scope mapping overrides useless).
    mappings: row(
      m("VARCHAR", { length: 255 }),
      m("VARCHAR", { length: 255 }, { unicode: true }),
      m("VARCHAR", { length: 255 }),
      m("VARCHAR", { length: 255 }),
      m("NVARCHAR", { length: 255 }),
      m("NVARCHAR2", { length: 255 }),
      m("VARCHAR", { length: 255 }, { unicode: true }),
    ),
    builtin: true,
  },
  {
    id: "text",
    label: "type_family.text",
    params: [],
    mappings: row(
      m("TEXT"),
      m("TEXT"),
      m("TEXT"),
      m("TEXT"),
      m("TEXT"),
      m("CLOB"),
      m("TEXT"),
    ),
    builtin: true,
  },
  {
    id: "integer",
    label: "type_family.integer",
    params: [],
    mappings: row(
      m("INT"),
      m("INTEGER"),
      m("INTEGER"),
      m("INTEGER"),
      m("INTEGER"),
      m("NUMBER", { precision: 10 }),
      m("INTEGER"),
    ),
    builtin: true,
  },
  {
    id: "decimal",
    label: "type_family.decimal",
    params: [
      param("precision", "type_param.precision"),
      param("scale", "type_param.scale"),
    ],
    // Same as string: the (10, 2) default is carried by the mapping rows.
    mappings: row(
      m("DECIMAL", { precision: 10, scale: 2 }),
      m("DECIMAL", { precision: 10, scale: 2 }),
      m("NUMERIC", { precision: 10, scale: 2 }),
      m("NUMERIC"),
      m("DECIMAL", { precision: 10, scale: 2 }),
      m("NUMBER", { precision: 10, scale: 2 }),
      m("DECIMAL", { precision: 10, scale: 2 }),
    ),
    builtin: true,
  },
  {
    id: "boolean",
    label: "type_family.boolean",
    params: [],
    mappings: row(
      m("BOOLEAN"),
      m("TINYINT", { length: 1 }),
      m("BOOLEAN"),
      m("BOOLEAN"),
      m("BIT"),
      m("NUMBER", { precision: 1 }),
      m("TINYINT", { length: 1 }),
    ),
    builtin: true,
  },
  {
    id: "date",
    label: "type_family.date",
    params: [],
    mappings: row(
      m("DATE"),
      m("DATE"),
      m("DATE"),
      m("DATE"),
      m("DATE"),
      m("DATE"),
      m("DATE"),
    ),
    builtin: true,
  },
  {
    id: "datetime",
    label: "type_family.datetime",
    params: [],
    mappings: row(
      m("TIMESTAMP"),
      m("DATETIME"),
      m("TIMESTAMP", { precision: 6 }),
      m("TIMESTAMP"),
      m("DATETIME2"),
      m("TIMESTAMP"),
      m("DATETIME"),
    ),
    builtin: true,
  },
  {
    id: "binary",
    label: "type_family.binary",
    params: [param("length", "type_param.length")],
    mappings: row(
      m("BLOB"),
      m("BLOB"),
      m("BYTEA"),
      m("BLOB"),
      m("VARBINARY"),
      m("BLOB"),
      m("BLOB"),
    ),
    builtin: true,
  },
  {
    id: "enum",
    label: "type_family.enum",
    params: [],
    mappings: row(
      m("ENUM"),
      m("ENUM"),
      m("TEXT"),
      m("TEXT"),
      m("VARCHAR", { length: 50 }),
      m("VARCHAR2", { length: 50 }),
      m("ENUM"),
    ),
    builtin: true,
  },
  {
    id: "json",
    label: "type_family.json",
    params: [],
    mappings: row(
      m("JSON"),
      m("JSON"),
      m("JSON"),
      m("TEXT"),
      m("NVARCHAR"),
      m("CLOB"),
      m("JSON"),
    ),
    builtin: true,
  },
  {
    id: "uuid",
    label: "type_family.uuid",
    params: [],
    mappings: row(
      m("UUID"),
      m("CHAR", { length: 36 }),
      m("UUID"),
      m("TEXT"),
      m("UNIQUEIDENTIFIER"),
      m("CHAR", { length: 36 }),
      m("CHAR", { length: 36 }),
    ),
    builtin: true,
  },
];

export const BUILTIN_FAMILY_IDS: BuiltinFamilyId[] = BUILTIN_FAMILIES.map(
  (family) => family.id as BuiltinFamilyId,
);
