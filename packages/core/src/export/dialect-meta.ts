export interface TypeMetadata {
  isSized?: boolean;
  hasPrecision?: boolean;
  hasCheck?: boolean;
  signed?: boolean;
  hasQuotes?: boolean;
}

export type DialectMetadata = Record<string, TypeMetadata | undefined>;

// Minimal metadata for MySQL export; expanded in Task 9.
export const mysqlMetadata: DialectMetadata = {
  INT: { isSized: true, hasCheck: true, signed: true },
  BIGINT: { isSized: true, hasCheck: true, signed: true },
  SMALLINT: { isSized: true, hasCheck: true, signed: true },
  TINYINT: { isSized: true, hasCheck: true, signed: true },
  MEDIUMINT: { isSized: true, hasCheck: true, signed: true },
  VARCHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  CHAR: { isSized: true, hasCheck: true, hasQuotes: true },
  TEXT: { hasCheck: true, hasQuotes: true },
  MEDIUMTEXT: { hasCheck: true, hasQuotes: true },
  LONGTEXT: { hasCheck: true, hasQuotes: true },
  TIMESTAMP: { hasCheck: true },
  DATETIME: { hasCheck: true },
  DATE: { hasCheck: true },
  TIME: { hasCheck: true },
  YEAR: { hasCheck: true },
  DECIMAL: { isSized: true, hasPrecision: true, hasCheck: true, signed: true },
  NUMERIC: { isSized: true, hasPrecision: true, hasCheck: true, signed: true },
  FLOAT: { isSized: true, hasCheck: true, signed: true },
  DOUBLE: { isSized: true, hasCheck: true, signed: true },
  BOOLEAN: { hasCheck: true },
  BIT: { isSized: true, hasCheck: true },
  BINARY: { isSized: true, hasCheck: true },
  VARBINARY: { isSized: true, hasCheck: true },
  BLOB: { hasCheck: true },
  ENUM: { hasCheck: true, hasQuotes: true },
  SET: { hasCheck: true, hasQuotes: true },
  JSON: { hasCheck: true },
};

const dialects: Record<string, DialectMetadata> = {
  mysql: mysqlMetadata,
};

export function getTypeMetadata(
  database: string,
  type: string,
): TypeMetadata | undefined {
  return dialects[database]?.[type.toUpperCase()];
}
