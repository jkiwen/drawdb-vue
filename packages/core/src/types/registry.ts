import type { DatabaseType } from "../models/diagram.ts";

/**
 * Canonical type names recognised by each database dialect.
 *
 * Generated from the React drawDB `src/data/datatypes.js` type tables by
 * `scripts/generate-type-registry.mjs`.
 */
export const DATABASE_TYPE_NAMES: Record<DatabaseType, readonly string[]> = {
  generic: [
    "INT",
    "SMALLINT",
    "BIGINT",
    "DECIMAL",
    "NUMERIC",
    "NUMBER",
    "FLOAT",
    "DOUBLE",
    "REAL",
    "CHAR",
    "VARCHAR",
    "VARCHAR2",
    "TEXT",
    "TIME",
    "TIMESTAMP",
    "DATE",
    "DATETIME",
    "BOOLEAN",
    "BINARY",
    "VARBINARY",
    "BLOB",
    "CLOB",
    "NCLOB",
    "JSON",
    "UUID",
    "ENUM",
    "SET",
  ],
  mysql: [
    "TINYINT",
    "SMALLINT",
    "MEDIUMINT",
    "INTEGER",
    "BIGINT",
    "DECIMAL",
    "NUMERIC",
    "FLOAT",
    "DOUBLE",
    "BIT",
    "BOOLEAN",
    "TIME",
    "TIMESTAMP",
    "DATE",
    "DATETIME",
    "YEAR",
    "CHAR",
    "VARCHAR",
    "BINARY",
    "VARBINARY",
    "TINYBLOB",
    "BLOB",
    "MEDIUMBLOB",
    "LONGBLOB",
    "TINYTEXT",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "ENUM",
    "SET",
    "GEOMETRY",
    "POINT",
    "LINESTRING",
    "POLYGON",
    "MULTIPOINT",
    "MULTILINESTRING",
    "MULTIPOLYGON",
    "GEOMETRYCOLLECTION",
    "JSON",
  ],
  mariadb: [
    "TINYINT",
    "SMALLINT",
    "MEDIUMINT",
    "INTEGER",
    "BIGINT",
    "DECIMAL",
    "NUMERIC",
    "FLOAT",
    "DOUBLE",
    "BIT",
    "BOOLEAN",
    "TIME",
    "TIMESTAMP",
    "DATE",
    "DATETIME",
    "YEAR",
    "CHAR",
    "VARCHAR",
    "BINARY",
    "VARBINARY",
    "TINYBLOB",
    "BLOB",
    "MEDIUMBLOB",
    "LONGBLOB",
    "TINYTEXT",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "ENUM",
    "SET",
    "GEOMETRY",
    "POINT",
    "LINESTRING",
    "POLYGON",
    "MULTIPOINT",
    "MULTILINESTRING",
    "MULTIPOLYGON",
    "GEOMETRYCOLLECTION",
    "JSON",
    "UUID",
    "INET4",
    "INET6",
  ],
  postgres: [
    "SMALLINT",
    "INTEGER",
    "BIGINT",
    "DECIMAL",
    "NUMERIC",
    "REAL",
    "SMALLSERIAL",
    "SERIAL",
    "BIGSERIAL",
    "MONEY",
    "CHAR",
    "VARCHAR",
    "TEXT",
    "BYTEA",
    "DATE",
    "TIME",
    "TIMETZ",
    "TIMESTAMP",
    "TIMESTAMPTZ",
    "INTERVAL",
    "BOOLEAN",
    "POINT",
    "LINE",
    "LSEG",
    "BOX",
    "PATH",
    "POLYGON",
    "CIRCLE",
    "CIDR",
    "INET",
    "MACADDR",
    "MACADDR8",
    "BIT",
    "VARBIT",
    "VECTOR",
    "HALFVEC",
    "SPARSEVEC",
    "TSVECTOR",
    "TSQUERY",
    "JSON",
    "JSONB",
    "UUID",
    "XML",
  ],
  sqlite: [
    "INTEGER",
    "REAL",
    "NUMERIC",
    "BOOLEAN",
    "VARCHAR",
    "TEXT",
    "BLOB",
    "TIME",
    "TIMESTAMP",
    "DATE",
    "DATETIME",
  ],
  mssql: [
    "TINYINT",
    "SMALLINT",
    "INTEGER",
    "BIGINT",
    "BIT",
    "DECIMAL",
    "NUMERIC",
    "FLOAT",
    "DOUBLE",
    "REAL",
    "MONEY",
    "SMALLMONEY",
    "DATE",
    "DATETIME",
    "DATETIME2",
    "DATETIMEOFFSET",
    "SMALLDATETIME",
    "TIME",
    "TIMESTAMP",
    "CHAR",
    "VARCHAR",
    "TEXT",
    "NCHAR",
    "NVARCHAR",
    "NTEXT",
    "BINARY",
    "VARBINARY",
    "IMAGE",
    "UNIQUEIDENTIFIER",
    "XML",
    "CURSOR",
    "SQL_VARIANT",
    "JSON",
  ],
  oraclesql: [
    "INTEGER",
    "NUMBER",
    "FLOAT",
    "LONG",
    "VARCHAR2",
    "NVARCHAR2",
    "CHAR",
    "NCHAR",
    "CLOB",
    "NCLOB",
    "BLOB",
    "BFILE",
    "JSON",
    "VECTOR",
    "DATE",
    "TIMESTAMP",
    "INTERVAL",
    "BOOLEAN",
    "RAW",
  ],
};

/**
 * The kind of value a type accepts as a default.
 *
 * - `numeric` — a number,
 * - `boolean` — true or false,
 * - `date` — a date or a timestamp,
 * - `text` — any text,
 * - `none` — the type cannot have a default at all.
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
 * Generated from the React drawDB `src/data/datatypes.js` type tables by
 * `scripts/generate-type-registry.mjs`.
 */
export const DATABASE_TYPE_METADATA: Record<
  DatabaseType,
  Record<string, TypeMetadata>
> = {
  generic: {
    "INT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "BIGINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "DECIMAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMBER": { isSized: false, hasPrecision: true, canIncrement: false, hasCheck: true, defaultKind: "numeric" },
    "FLOAT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "DOUBLE": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "REAL": { isSized: false, hasPrecision: false, hasCheck: true, defaultKind: "numeric" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR2": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "boolean" },
    "BINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "VARBINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "BLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "CLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "NCLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "UUID": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: false, defaultKind: "text" },
    "ENUM": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "SET": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
  },
  mysql: {
    "TINYINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "MEDIUMINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "BIGINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "DECIMAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "FLOAT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "DOUBLE": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "BIT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "boolean" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "YEAR": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "numeric" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "BINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "VARBINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "TINYBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "BLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MEDIUMBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "LONGBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "TINYTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "MEDIUMTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "LONGTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "ENUM": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "SET": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "GEOMETRY": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "POINT": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "LINESTRING": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "POLYGON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTIPOINT": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTILINESTRING": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTIPOLYGON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "GEOMETRYCOLLECTION": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
  },
  mariadb: {
    "TINYINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "MEDIUMINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "BIGINT": { isSized: false, hasPrecision: false, canIncrement: true, signed: true, hasCheck: true, defaultKind: "numeric" },
    "DECIMAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "FLOAT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "DOUBLE": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "BIT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "boolean" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "YEAR": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "numeric" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "BINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "VARBINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "TINYBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "BLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MEDIUMBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "LONGBLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "TINYTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "MEDIUMTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "LONGTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "ENUM": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "SET": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "GEOMETRY": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "POINT": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "LINESTRING": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "POLYGON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTIPOINT": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTILINESTRING": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "MULTIPOLYGON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "GEOMETRYCOLLECTION": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "UUID": { isSized: false, hasPrecision: false, hasCheck: true, noDefault: false, defaultKind: "text" },
    "INET4": { isSized: false, hasPrecision: false, hasCheck: true, noDefault: false, defaultKind: "text" },
    "INET6": { isSized: false, hasPrecision: false, hasCheck: true, noDefault: false, defaultKind: "text" },
  },
  postgres: {
    "SMALLINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "BIGINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "DECIMAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "REAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLSERIAL": { isSized: false, hasPrecision: false, hasCheck: true, defaultKind: "numeric" },
    "SERIAL": { isSized: false, hasPrecision: false, hasCheck: true, defaultKind: "numeric" },
    "BIGSERIAL": { isSized: false, hasPrecision: false, hasCheck: true, defaultKind: "numeric" },
    "MONEY": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "BYTEA": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMETZ": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMPTZ": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "INTERVAL": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "boolean" },
    "POINT": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
    "LINE": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
    "LSEG": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
    "BOX": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "PATH": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "POLYGON": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "CIRCLE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "CIDR": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "INET": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "MACADDR": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "MACADDR8": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "BIT": { isSized: true, hasPrecision: false, hasQuotes: false, hasCheck: true, defaultKind: "numeric" },
    "VARBIT": { isSized: true, hasPrecision: false, hasQuotes: false, hasCheck: true, defaultKind: "text" },
    "VECTOR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "HALFVEC": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "SPARSEVEC": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TSVECTOR": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
    "TSQUERY": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
    "JSON": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSONB": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
    "UUID": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: false, defaultKind: "text" },
    "XML": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
  },
  sqlite: {
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "REAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "boolean" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "BLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
  },
  mssql: {
    "TINYINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "BIGINT": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "BIT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "DECIMAL": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "NUMERIC": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "FLOAT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "DOUBLE": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "REAL": { isSized: false, hasPrecision: false, hasCheck: true, defaultKind: "numeric" },
    "MONEY": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "SMALLMONEY": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "text" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIME2": { isSized: false, hasPrecision: true, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "DATETIMEOFFSET": { isSized: false, hasPrecision: true, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "SMALLDATETIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIME": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "TEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "NCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "NVARCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "NTEXT": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "BINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "VARBINARY": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "IMAGE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
    "UNIQUEIDENTIFIER": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "XML": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
    "CURSOR": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "SQL_VARIANT": { isSized: false, hasPrecision: false, hasQuotes: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSON": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, noDefault: true, defaultKind: "none" },
  },
  oraclesql: {
    "INTEGER": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "numeric" },
    "NUMBER": { isSized: false, hasPrecision: true, canIncrement: false, hasCheck: true, defaultKind: "numeric" },
    "FLOAT": { isSized: false, hasPrecision: true, hasCheck: true, defaultKind: "numeric" },
    "LONG": { isSized: false, hasPrecision: false, canIncrement: true, hasCheck: true, defaultKind: "text" },
    "VARCHAR2": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "NVARCHAR2": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "CHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "NCHAR": { isSized: true, hasPrecision: false, hasQuotes: true, hasCheck: true, defaultKind: "text" },
    "CLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "NCLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "BLOB": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "BFILE": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "JSON": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "VECTOR": { isSized: false, hasPrecision: false, hasCheck: false, noDefault: true, defaultKind: "none" },
    "DATE": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "TIMESTAMP": { isSized: false, hasPrecision: true, hasQuotes: true, hasCheck: false, defaultKind: "date" },
    "INTERVAL": { isSized: false, hasPrecision: false, hasQuotes: true, hasCheck: false, defaultKind: "text" },
    "BOOLEAN": { isSized: false, hasPrecision: false, hasCheck: false, defaultKind: "boolean" },
    "RAW": { isSized: true, hasPrecision: false, hasQuotes: false, hasCheck: false, defaultKind: "text" },
  },
};

/**
 * Fallback type used when a parsed type is not recognised by the dialect.
 * Mirrors the affinity tables used by the React importer.
 */
export const FALLBACK_TYPE = "BLOB";

const TYPE_NAME_SETS: Record<DatabaseType, ReadonlySet<string>> = {
  generic: new Set(DATABASE_TYPE_NAMES.generic),
  mysql: new Set(DATABASE_TYPE_NAMES.mysql),
  mariadb: new Set(DATABASE_TYPE_NAMES.mariadb),
  postgres: new Set(DATABASE_TYPE_NAMES.postgres),
  sqlite: new Set(DATABASE_TYPE_NAMES.sqlite),
  mssql: new Set(DATABASE_TYPE_NAMES.mssql),
  oraclesql: new Set(DATABASE_TYPE_NAMES.oraclesql),
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

/** True when `type` is a known type name for `database` (case-insensitive). */
export function isKnownTypeName(database: DatabaseType, type: string): boolean {
  const set = TYPE_NAME_SETS[database];
  if (!set) return false;
  return set.has(String(type).toUpperCase());
}

/**
 * Resolve the canonical type name for a parsed SQL type.
 * Unknown types fall back to the dialect affinity table, then to
 * `FALLBACK_TYPE`.
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
 * `VARCHAR(255)` or `DECIMAL(10,2)`.
 */
export function typeTakesSize(
  type: string,
  database: DatabaseType,
): boolean {
  const meta = getTypeMetadata(database, type);
  return Boolean(meta && (meta.isSized || meta.hasPrecision));
}

const NUMERIC_TYPE_NAMES = new Set([
  "INT",
  "INT2",
  "INT4",
  "INT8",
  "INTEGER",
  "SMALLINT",
  "TINYINT",
  "MEDIUMINT",
  "BIGINT",
  "DECIMAL",
  "NUMERIC",
  "NUMBER",
  "FLOAT",
  "REAL",
  "DOUBLE",
  "DOUBLE PRECISION",
  "MONEY",
  "SERIAL",
  "SMALLSERIAL",
  "BIGSERIAL",
  "YEAR",
  "BIT",
]);

const BOOLEAN_TYPE_NAMES = new Set([
  "BOOLEAN",
  "BOOL",
]);

const DATE_TYPE_NAMES = new Set([
  "DATE",
  "DATETIME",
  "DATETIME2",
  "DATETIMEOFFSET",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "TIME",
  "TIMETZ",
  "SMALLDATETIME",
  "DATETIME2 TZ",
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
