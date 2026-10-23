# Task 6 Report — Implement Storage Adapters

**Status:** complete
**Commit:** `42d1f34` — `feat(core): add storage adapters (memory + IndexedDB) and workspace test runner`
**Plan section:** `docs/plan.md` lines 381-433

## What was built

`packages/core/src/storage/`

| File | Purpose |
| --- | --- |
| `storage-adapter.ts` | `StorageAdapter` contract, `StorageError` (codes `invalid-id`, `not-found`, `unavailable`, `unknown`), `assertDiagramId`, `cloneDiagram` |
| `memory-adapter.ts` | `MemoryStorageAdapter` — `Map` backed, returns defensive copies |
| `indexeddb-adapter.ts` | `IndexedDBStorageAdapter` — raw IndexedDB API, no runtime dependency |
| `index.ts` | barrel |

### `StorageAdapter` contract

```typescript
interface StorageAdapter {
  load(id: string): Promise<Diagram | undefined>;
  save(diagram: Diagram): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Diagram[]>;
  listIds(): Promise<string[]>;
  clear(): Promise<void>;
  close?(): Promise<void>;
}
```

Design decisions:

- `load` resolves to `undefined` for a missing record instead of throwing, so
  callers never have to guard with try/catch.
- `save` rejects a diagram without an `id` with a `StorageError` whose code is
  `invalid-id`.
- `delete` of an unknown id is a no-op, not an error.
- `IndexedDBStorageAdapter` speaks the raw IndexedDB API rather than pulling in
  Dexie, so `@drawdb/core` keeps zero runtime dependencies beyond the SQL
  parsers. The database is opened lazily on the first call; the object store
  `diagrams` is created with `keyPath: "id"` and indexed on `database` and
  `lastModified`.
- `save` stamps `lastModified` with an ISO timestamp.
- A missing `globalThis.indexedDB` (SSR, Node) rejects with
  `StorageError("unavailable", ...)`.

## Tests

`packages/core/src/storage/memory-adapter.test.ts` (9 cases) and
`packages/core/src/storage/indexeddb-adapter.test.ts` (8 cases), written
test-first — both failed with `ERR_MODULE_NOT_FOUND` before the
implementation existed.

Coverage: save/load round trip, missing id, missing diagram id rejection,
overwrite semantics, delete, delete of an unknown id, list, listIds, clear,
defensive copy on read, and persistence across adapter instances (IndexedDB
only).

```
node --experimental-strip-types packages/core/src/storage/memory-adapter.test.ts    → 9/9 pass
node --experimental-strip-types packages/core/src/storage/indexeddb-adapter.test.ts → 8/8 pass
```

The IndexedDB suite runs against `fake-indexeddb` (dev dependency of
`@drawdb/core`).

## Additional infrastructure

- `packages/core/tsconfig.json` — typecheck config extending the workspace
  base, with `allowImportingTsExtensions` (the project imports `.ts`
  specifiers) and `noEmit`.
- `scripts/run-tests.mjs` — workspace test runner. The sandboxed Windows
  environment throws `EPERM` when `node --test` and vitest spawn child
  processes, so the runner imports every spec file into one process; the
  `node:test` reporter still prints results and the process fails on a red
  spec. Usage: `node --experimental-strip-types scripts/run-tests.mjs [filter]`.
- `packages/core/src/types/vendor.d.ts` — ambient declaration for the
  untyped `oracle-sql-parser` package.

## Deviations from the plan

- The plan named only `indexeddb-adapter.test.ts`; a separate
  `memory-adapter.test.ts` was added because the plan's own sample test in
  step 1 targets the memory adapter.
- `StorageAdapter` carries a small superset of the plan's description
  (`listIds`, `close`) so the SDK can render a diagram list without reading
  every record.
