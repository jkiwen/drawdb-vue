/**
 * `oracle-sql-parser` ships without TypeScript declarations.
 * The package is CommonJS and exposes a `Parser` class.
 */
declare module "oracle-sql-parser" {
  export class Parser {
    parse(sql: string, options?: Record<string, unknown>): unknown;
  }

  const oracleSqlParser: { Parser: typeof Parser };
  export default oracleSqlParser;
}
