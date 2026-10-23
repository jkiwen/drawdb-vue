# Task 8 — Migrate DBML Utilities

**Status:** complete
**Plan:** `docs/plan.md:500-552`
**Commit:** `feat(core): migrate dbml utilities`

## Scope

Port the DBML support of the React drawDB app into `@drawdb/core`:

| React source | SDK module |
| --- | --- |
| `src/utils/dbml/parse.js` | `packages/core/src/dbml/parse.ts` |
| `src/utils/dbml/types.js` | `packages/core/src/dbml/types.ts` |
| `src/utils/dbml/reconcile.js` | `packages/core/src/dbml/reconcile.ts` |
| `src/utils/exportAs/dbml.js` | `packages/core/src/dbml/export.ts` |
| `src/utils/dbml/diff.js` | `packages/core/src/dbml/diff.ts` |

Public API (re-exported from `packages/core/src/dbml/index.ts`):

- `parseDBML(source, options?): Diagram` — parse a DBML source into a complete diagram.
- `parseDBMLPartial(source): ParsedDBML` — parse into name-keyed parts, for callers that want to merge into an existing diagram.
- `exportDBML(diagram): string` — export a diagram as DBML.
- `diffDBML(from, to): DBMLDiff` — compute the operation list that turns `from` into `to`.
- `reconcileDBML(parsed, base, database): ReconciledDBML` — merge parsed parts into an existing diagram, preserving ids and positions.

## Dependencies

`@dbml/core@^3.13.9` was added to `@drawdb/core` (resolved to 3.14.1). The package is CommonJS; the named import `import { Parser } from "@dbml/core"` still works under Node ESM because `cjs-module-lexer` detects the named export.

A `declare module "@dbml/core"` ambient declaration was added to `packages/core/src/types/vendor.d.ts` so the untyped AST is usable from TypeScript.

## Type metadata rework (prerequisite)

`typeTakesSize()` and the DBML exporter need to know whether a dialect type takes a size argument and whether it is quoted. The React app keeps that information in `src/data/datatypes.js`; the SDK's `scripts/types-extracted.json` only held the type *names*.

`scripts/extract-types.mjs` was rewritten to extract the per-type flags (`isSized`, `hasPrecision`, `hasQuotes`, `canIncrement`, `signed`, `hasCheck`, `noDefault`) for all seven dialects, and `scripts/generate-type-registry.mjs` now emits them into `packages/core/src/types/registry.ts` as `DATABASE_TYPE_METADATA` / `getTypeMetadata()`. The hand-written MySQL-only table in `packages/core/src/export/dialect-meta.ts` was replaced by a delegation to the generated registry, so the SQL exporters and the DBML exporter now share one source of truth.

Extraction is line-based (type keys sit on lines with exactly two spaces of indent, the block ends at the first `};` line). The first attempt used a brace-matching scanner and failed on the postgres block because `checkDefault` bodies contain braces.

## Differences from the React implementation

- **Ids**: `nanoid()` is replaced by `createId()` (`packages/core/src/utils/id.ts`).
- **Layout**: `arrangeTables()` from `packages/core/src/utils/arrange-tables.ts` is used for the initial placement, matching the SQL import path.
- **Referential actions** are stored with the `Constraint` vocabulary (`"Cascade"`, `"No action"`, …) instead of the raw DBML keyword, so the DBML and SQL sides agree.
- **Parse errors** are wrapped in `DBMLParseError`, which carries the `@dbml/core` diagnostics.

## Bugs found while porting

1. The plan's example DBML (`Table users { id int [pk] name varchar }`) is **invalid** — DBML requires one field per line. The ported parser rejects it with `DBMLParseError`; the tests use a valid multi-line source.
2. `Ref: name { ... }` (with a colon) is invalid DBML; the correct form is `Ref name { ... }`. The exporter emits the valid form.
3. A function default must be written as ``default: `now()` `` (backticks) in DBML; the exporter wraps function defaults in backticks and the parser reads the raw value back.

## Tests

`packages/core/src/dbml/index.test.ts` — 20 specs, all passing:

- parse: tables, enums, relationships, table comment/colour, field flags, enum values, indexes, composite primary keys, inline-enum folding, endpoint resolution, invalid source.
- export: table/enum/ref blocks, index blocks, tables without fields skipped, round-trip through DBML.
- diff: no-ops for identical diagrams, created/deleted tables, updated fields, whole-field-list replacement on a shape change, enum changes.

Workspace suite: **189/189 pass**. `pnpm run typecheck` is clean.

## Notes for the SDK layer

- `parseDBML` returns a diagram whose tables are laid out but not yet positioned by the user; the canvas layer can request a re-arrange.
- `diffDBML` is the basis for the "import DBML into the current diagram" flow: the operation list can be applied to the live diagram, and `reconcileDBML` is the alternative that mutates in place while preserving ids.
