# Task 4 Report: Migrate SQL Export Utilities

## Scope
Migrate all 7 SQL export dialects from the React drawDB codebase into `@drawdb/core`.

## Files Added

### Shared engine
- `packages/core/src/export/dialect-meta.ts` — minimal per-type metadata (isSized, hasPrecision, signed, hasCheck). Only MySQL metadata is populated; other dialects define local metadata maps. Task 9 will expand this into a full system.
- `packages/core/src/export/shared.ts` — `getFkColumnNames`, `parseDefault`, `escapeQuotes`, `uniqueConstraintClause`, `getInlineFK`, `getRelationshipFields`.
- `packages/core/src/export/views.ts` — `buildViewSQL`, `appendViews`, identifier quoting, and dialect-specific view statement generation.
- `packages/core/src/export/index.ts` — `exportSQL(diagram)` dispatcher and `SQLDialect` type.

### Dialect implementations
- `packages/core/src/export/mysql.ts` — `toMySQL()` (inline).
- `packages/core/src/export/postgres.ts` — `toPostgres()` (subagent).
- `packages/core/src/export/sqlite.ts` — `toSqlite()` (subagent).
- `packages/core/src/export/mariadb.ts` — `toMariadb()` (subagent).
- `packages/core/src/export/mssql.ts` — `toMssql()` (subagent).
- `packages/core/src/export/oraclesql.ts` — `toOracleSql()` (subagent).
- `packages/core/src/export/generic.ts` — `toGeneric()` (subagent, ANSI-style fallback).

### Tests
- `packages/core/src/export/mysql.test.ts` — 6 tests.
- `packages/core/src/export/postgres.test.ts` — 6 tests.
- `packages/core/src/export/mariadb.test.ts` — 5 tests.
- `packages/core/src/export/sqlite.test.ts` — 4 tests.
- `packages/core/src/export/mssql.test.ts` — 6 tests.
- `packages/core/src/export/oraclesql.test.ts` — 5 tests.
- `packages/core/src/export/generic.test.ts` — 5 tests.

Total: **37 tests, all passing**.

## Model Change
- Added `unsigned?: boolean` to `Field` (`packages/core/src/models/field.ts`) to support MySQL UNSIGNED.

## Verification

```bash
cd sdk-workspace
node --experimental-strip-types packages/core/src/export/mysql.test.ts
node --experimental-strip-types packages/core/src/export/postgres.test.ts
node --experimental-strip-types packages/core/src/export/mariadb.test.ts
node --experimental-strip-types packages/core/src/export/sqlite.test.ts
node --experimental-strip-types packages/core/src/export/mssql.test.ts
node --experimental-strip-types packages/core/src/export/oraclesql.test.ts
node --experimental-strip-types packages/core/src/export/generic.test.ts
```

Result: **37/37 pass**.

## Known Gaps / Next Steps
- `dialect-meta.ts` is intentionally minimal; dialects keep local metadata. Task 9 will unify type metadata.
- View SQL quoting is dialect-aware and exercised for all dialects, but complex view edge cases may need further alignment with the React implementation.
