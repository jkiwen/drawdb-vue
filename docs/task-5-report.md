# Task 5 Report — Migrate SQL Import Utilities

**Status:** Complete
**Plan section:** `sdk-workspace/docs/plan.md:326-378`
**Test result:** 169/169 workspace specs pass (`node --experimental-strip-types scripts/run-tests.mjs`); `pnpm run typecheck` clean.

## What was built

`packages/core/src/sql/import/` now turns a SQL script into a `Diagram` for every
supported dialect.

| File | Purpose |
| --- | --- |
| `parser.ts` | `parseSQL(sql, database): ASTNode[]`, `SQLImportError`, `isSupportedDatabase` |
| `shared.ts` | `ASTNode`, `ImportedDiagramFragment`, identifier quoting, default-value reading |
| `mysql.ts` | `fromMySQL` — reference importer, also used for the `generic` dialect |
| `mariadb.ts` | `fromMariaDB` |
| `postgres.ts` | `fromPostgres` |
| `sqlite.ts` | `fromSQLite` |
| `mssql.ts` | `fromMSSQL` |
| `mssql-parser.ts` | dedicated T-SQL DDL parser (see below) |
| `oraclesql.ts` | `fromOracleSQL` |
| `index.ts` | `importSQL(sql, database, options?): Diagram` + barrel exports |

Supporting utilities added along the way:

- `packages/core/src/types/registry.ts` — generated from the React `src/data/datatypes.js`
  by `scripts/extract-types.mjs` + `scripts/generate-type-registry.mjs`. Provides
  `DATABASE_TYPE_NAMES`, `TYPE_AFFINITY`, `isKnownTypeName`, `canonicalTypeName`.
  Unknown types fall back to `FALLBACK_TYPE = "BLOB"`, mirroring the React importers.
- `packages/core/src/utils/id.ts` — `createId()`.
- `packages/core/src/utils/arrange-tables.ts` — port of React `src/utils/arrangeTables.js`,
  applied to every imported diagram so tables never overlap.
- `packages/core/src/models/constants.ts` — `Cardinality` and `Constraint` enums.
- `packages/core/src/models/relationship.ts` — gained `RelationshipFieldPair` and the optional
  `fields` property for composite foreign keys.

## The MSSQL problem

`node-sql-parser` exposes a `transactsql` grammar, but it **cannot parse foreign keys**:

| Input | Result |
| --- | --- |
| `CONSTRAINT [fk] FOREIGN KEY (user_id) REFERENCES [dbo].[users] ([id])` | `SyntaxError: expected ")" or ","` |
| inline `user_id INT REFERENCES [dbo].[users] ([id])` | same class of error |
| `ON DELETE CASCADE` | `SyntaxError: Expected "--", "/*", "UPDATE", ... but "D" found.` |
| `ON UPDATE NO ACTION` | `SyntaxError: ... but "N" found.` |
| `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` | `SyntaxError` (the grammar only supports `ALTER TABLE ... ADD COLUMN`) |

React's `src/utils/importSQL/mssql.js` was therefore dead code: importing any T-SQL
script containing a foreign key threw in the React app as well.

Rather than ship an importer that silently drops every foreign key, Task 5 adds
`mssql-parser.ts` — a hand-written T-SQL DDL parser that emits the same AST shapes the
other importers consume. It understands `CREATE TABLE`, `CREATE [UNIQUE] INDEX` and
`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`, ignores statements without diagram
information (`SET`, `CREATE VIEW`, `CREATE PROCEDURE`, ...), and strips `--` comments,
`/* */` blocks and `GO` batch separators.

`fromMSSQL` resolves foreign keys in two phases, so a table may reference a table that
is created later in the script. When a `REFERENCES` clause names no columns, the primary
key of the referenced table is used.

## Bugs found and fixed against the React behaviour

1. `ALTER TABLE ... ADD FOREIGN KEY` produced no relationships: the ALTER branch read
   `expression.table`, but an ALTER AST carries the table on the **statement** node.
   Now reads `statement.table?.[0]?.table`.
2. React's importer marks an explicitly `NULL` column as `NOT NULL` (it checks
   `if (d.nullable)`). The SDK checks `nullable.type === "not null"`, so an explicit
   `NULL` stays nullable.
3. A missing `CONSTRAINT` keyword in a table-level `FOREIGN KEY` clause was silently
   dropped by the first draft of the T-SQL parser; the clause is now found with a
   keyword search instead of an anchored regex.
4. A leading space after the constraint name defeated the `PRIMARY KEY` / `UNIQUE` /
   `FOREIGN KEY` keyword match; the remainder is now trimmed.

## Notes for the reviewer

- The `deleteConstraint` / `updateConstraint` values use the canonical `Constraint` enum
  (`"No action"`, `"Restrict"`, `"Cascade"`, `"Set null"`, `"Set default"`), not the raw
  SQL keywords. The React importers write the raw keyword (`"CASCADE"`); the SDK
  normalises so the export side and the UI share one vocabulary.
- `node-sql-parser` and `oracle-sql-parser` are CommonJS. Named ESM imports fail; the
  parsers are reached through the default export.
- `node-sql-parser` dialects used: `mysql`, `mariadb`, `postgresql`, `sqlite`. Oracle
  needs the separate `oracle-sql-parser` package; `mssql` uses the dedicated parser above.
