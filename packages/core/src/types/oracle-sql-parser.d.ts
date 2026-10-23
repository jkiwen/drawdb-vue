/**
 * `oracle-sql-parser` ships without TypeScript declarations. The package is
 * CommonJS and exposes a `Parser` class.
 *
 * The module is mapped onto this file through the `paths` entry of the
 * TypeScript configuration: TypeScript prefers a resolvable but untyped
 * JavaScript module over an ambient module declaration, so the declaration
 * has to take part in module resolution itself.
 */
declare const oracleSqlParser: {
  Parser: new () => {
    parse(sql: string, options?: Record<string, unknown>): unknown;
  };
};

export default oracleSqlParser;
