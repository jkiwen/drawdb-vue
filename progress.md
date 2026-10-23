# SDD ledger — plan: docs/plan.md

## Preflight
- Workspace: D:\dev\repos\github\drawdb\sdk-workspace
- Source reference: D:\dev\repos\github\drawdb (React drawDB for migration reference)
- Execution method: Inline execution (subagent dispatch returned late; Task 1 was completed inline and later reconciled with subagent report)

## Decisions
- SDK workspace is nested inside the drawDB repo because the file sandbox denies creating directories at the sibling level (`D:\dev\repos\github\drawdb-vue-sdk`). This is a workspace-location concession, not a code-structure concession; the SDK still ships as three independent packages from `packages/*`.

## Rulings
- **Task 1: Ruling: SDK workspace nested inside drawDB repo** — File sandbox denies creating `D:\dev\repos\github\drawdb-vue-sdk`; workspace lives at `D:\dev\repos\github\drawdb\sdk-workspace`. Cost if wrong: not a true independent repo; mitigated by separate Git history and `packages/*` layout.
- **Task 1: Ruling: `.npmrc` uses `node-linker=hoisted`** — pnpm isolated linker + Node v26 in this Windows sandbox cannot resolve transitive symlinks correctly; hoisted linker makes install exit 0. Cost if wrong: flatter node_modules; no behavioral impact on SDK output.
- **Task 1: Ruling: verification uses `node --experimental-strip-types scripts/verify-workspace.test.ts` instead of `pnpm exec vitest run scripts/verify-workspace.test.ts`** — The sandbox throws `EPERM` when vitest/esbuild or `node --test` spawn child processes with piped stdio. Cost if wrong: one less test-runner assertion API; same file-existence/JSON checks are executed.

## Task Progress
- Task 1: complete (commit `02194613f38481fe203d0dd502cce496052ee2b4`; tests: `node --experimental-strip-types scripts/verify-workspace.test.ts` → 8/8 pass; report: `docs/task-1-report.md`)
- Task 2: complete (commit `64cd4d26b48c6ac63b10b79f6d8c9bd0fdef4092`; tests: `node --experimental-strip-types packages/core/src/models/index.test.ts` → 3/3 pass)
- Task 3: complete (commit `c7db564137998812b7eedfeb1b67225406b978f9`; tests: `node --experimental-strip-types packages/core/src/commands/command-manager.test.ts` → 6/6 pass)
- Task 4: complete (commit `e3f414716381f76dff0020cfd74f13103257c677`; all 7 SQL export dialects ported; 37/37 tests pass)
  - Report: `docs/task-4-report.md`
- Task 5: complete (commit `135cf47b6a09d472d72470a31853951641ae6e36`; all 7 dialects import; dedicated T-SQL parser for MSSQL; 169/169 workspace specs pass)
  - Report: `docs/task-5-report.md`
- Task 6: complete (commit `42d1f34`; `StorageAdapter` + `MemoryStorageAdapter` + `IndexedDBStorageAdapter`; 17/17 tests pass)
  - Report: `docs/task-6-report.md`
- Task 7: complete (commit `9c3130a74e49f0cb5144abc12218ca9bf5f3ee5a`; `MetadataSchema` / `MetadataRegistry` / `Plugin` / `PluginManager` / extension points; 27/27 tests pass)
  - Report: `docs/task-7-report.md`

## Rulings
- **Task 3: Ruling: Node `--experimental-strip-types` does not support TypeScript parameter properties** — Converted all command classes to explicit constructor assignments. Cost if wrong: slightly more boilerplate; fully equivalent runtime behavior.

## Rulings
- **Task 2: Ruling: model imports use explicit `.ts` extensions** — Node v26 `--experimental-strip-types` resolves ESM specifiers literally. Bundlers (Vite/rollup/tsc with `allowImportingTsExtensions`) accept `.ts` extensions. Cost if wrong: slightly non-standard appearance; mitigated by consistent project-wide convention.
- **Task 5: Ruling: SQL import uses `node-sql-parser` + `oracle-sql-parser` instead of a hand-written parser** — The React app already depends on `node-sql-parser`; reusing it keeps the dialects consistent with the export side. Oracle needs the separate `oracle-sql-parser` package because `node-sql-parser` has no `plsql` grammar. Both packages are CommonJS and must be default-imported and destructured. Cost if wrong: two parser dependencies instead of none; accepted because it replaces thousands of lines of hand-written SQL parsing.
- **Task 5: Ruling: `generic` dialect is parsed with the MySQL grammar** — `node-sql-parser` has no portable grammar. The MySQL grammar accepts the common subset, which is what the React app falls back to.
- **Task 6: Ruling: `IndexedDBStorageAdapter` uses the raw IndexedDB API instead of Dexie** — Keeps `@drawdb/core` free of runtime dependencies; the object store layout is three lines of code. Cost if wrong: no query-builder conveniences; not needed for the v1 feature set.
- **Task 6: Ruling: the workspace test runner imports every spec into one process** — `node --test` and vitest both spawn child processes, which the Windows sandbox blocks with `EPERM`. Cost if wrong: no per-file isolation; the specs are pure functions, so isolation is not required.
- **Task 5: Ruling: MSSQL uses a dedicated T-SQL parser instead of `node-sql-parser`** — The `transactsql` grammar of `node-sql-parser` cannot parse foreign keys (`FOREIGN KEY ... REFERENCES ...`, inline `REFERENCES`, `ON DELETE/UPDATE` and `ALTER TABLE ... ADD CONSTRAINT` all throw), so React's `src/utils/importSQL/mssql.js` was dead code. `packages/core/src/sql/import/mssql-parser.ts` parses the T-SQL subset that carries diagram information and emits the same AST shapes the other importers consume. Cost if wrong: ~650 lines of hand-written parsing to maintain; mitigated by 13 dedicated parser specs and by the fact that no other dialect needs it.
- **Task 5: Ruling: referential actions are normalised to the `Constraint` enum** — The React importers store the raw SQL keyword (`"CASCADE"`); the SDK stores `"Cascade"`, `"No action"`, `"Restrict"`, `"Set null"`, `"Set default"` so the export side and the UI share one vocabulary. Cost if wrong: values differ from the React app's stored diagrams; the SDK is a new codebase and does not load React diagrams.
- **Task 5: Ruling: `notNull` is derived from `nullable.type === "not null"`** — React's importer uses `if (d.nullable) field.notNull = true`, which marks an explicitly `NULL` column as `NOT NULL`. The SDK keeps the explicit `NULL` nullable. Cost if wrong: none; the SDK behaviour is the correct one.
- **Task 7: Ruling: `PluginManager` attributes extensions through a per-activation context closure** — A shared `this.currentOwner` field cannot attribute extensions correctly when two plugins activate concurrently. `createContext(base, owner)` binds `registerExtension` in a closure that records the owner, so deactivating a plugin removes exactly the extensions it contributed. Cost if wrong: a context object per activation; negligible.
