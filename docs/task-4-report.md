# Task 4 Report: Migrate SQL Export Utilities (MySQL foundation)

## Scope
Task 4 is to migrate all 7 SQL export dialects from the React drawDB codebase into `@drawdb/core`. This session delivers the **shared engine + MySQL dialect**; the remaining 6 dialects will be added in follow-up work.

## Files Added

### Shared engine
- `packages/core/src/export/dialect-meta.ts` — minimal per-type metadata (isSized, hasPrecision, signed, hasCheck). Only MySQL metadata is populated; Task 9 will expand this into a full system.
- `packages/core/src/export/shared.ts` — `getFkColumnNames`, `parseDefault`, `escapeQuotes`, `uniqueConstraintClause`, `getInlineFK`, `getRelationshipFields`.
- `packages/core/src/export/views.ts` — `buildViewSQL`, `appendViews`, identifier quoting, and dialect-specific view statement generation.
- `packages/core/src/export/index.ts` — `exportSQL(diagram)` dispatcher.

### MySQL dialect
- `packages/core/src/export/mysql.ts` — `toMySQL(diagram)`.

### Tests
- `packages/core/src/export/mysql.test.ts` — 6 tests covering:
  - CREATE TABLE with field attributes (unsigned, not null, auto increment, unique, default, enum, decimal)
  - table comment
  - indices
  - unique constraints
  - ALTER TABLE foreign keys
  - views with joins and aliases

## Model Change
- Added `unsigned?: boolean` to `Field` (`packages/core/src/models/field.ts`) to support MySQL UNSIGNED.

## Verification

```bash
cd sdk-workspace
node --experimental-strip-types packages/core/src/export/mysql.test.ts
```

Result: **6/6 pass**.

## Known Gaps / Next Steps
- `exportSQL` currently throws for `postgres`, `sqlite`, `mariadb`, `mssql`, `oraclesql`, and `generic`.
- `dialect-meta.ts` only contains MySQL metadata; other dialects will need their own maps or a unified metadata source.
- View SQL quoting is dialect-aware but only MySQL view generation has been exercised.
