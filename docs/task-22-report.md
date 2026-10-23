# Task 22 — core 自动布局与关系推断（layout）

**Plan:** `docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md` → Task 22
**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md` → §4.2

## Scope

The core package gained the two functions that the React reference has in
`src/utils/autoArrange.js` and `src/utils/autoRelationships.js`. Both are
framework-free: the SDK only has to call them and to turn the result into
commands.

| File | Content |
| --- | --- |
| `packages/core/src/layout/auto-arrange.ts` | `autoArrange(tables, relationships, options?)` |
| `packages/core/src/layout/auto-relationships.ts` | `inferRelationships(tables, existing?)` |
| `packages/core/src/layout/index.ts` | the barrel of the module |
| `packages/core/src/layout/layout.test.ts` | 14 specifications |
| `packages/core/src/index.ts` | exports the layout module |
| `packages/core/package.json` | the new dependency `@dagrejs/dagre@3.1.1` |

## The automatic layout

`autoArrange(tables, relationships, options?)` returns one `{ x, y }` per table,
**in the order of the input**.

| Option | Default | Meaning |
| --- | --- | --- |
| `nodeSep` | 60 | the gap between two tables of the same rank |
| `rankSep` | 110 | the gap between two ranks |
| `isolatedGap` | 60 | the gap around the isolated tables |
| `direction` | `"TB"` | the direction of the ranks (`"TB"` or `"LR"`) |

- A table that is **locked** keeps its coordinates and stays out of the graph.
- Only the tables that a relationship connects take part in the layout; the
  **isolated** ones are placed in rows below the others.
- A table without fields is `220 × 50`, a table with `n` fields is
  `220 × (50 + 36n)` — the same measures as the React reference.
- A layout that fails (a dagre error) leaves every table where it is; the
  function never throws.

## The relationship inference

`inferRelationships(tables, existing?)` looks at the **primary key** of every
table and at the fields of the other tables. A field whose name is the name of
the table of the parent followed by the name of its primary key is a foreign
key:

| Table | Field | Matches |
| --- | --- | --- |
| `users` | `id` | `users_id`, `user_id`, `usersid`, `userid` |

- The bare name of the primary key (`id`) is never a candidate — it would
  match every table.
- A table is never related to itself.
- A field that already starts a relationship, and a pair of fields that are
  already the ends of a relationship, are skipped.
- The cardinality is `one_to_one` when the foreign key is unique, else
  `many_to_one`; the referential actions are `No action`.
- The id of a candidate is `infer_<childTable>_<fkField>_<parentTable>` and
  its name is `fk_<childTable>_<fkField>_<parentTable>`.

## Differences from the plan

- **The direction defaults to `"TB"`.** The React reference uses `"LR"`, but
  the SDK canvas is vertical by default; the option makes both possible.
- **The isolated tables are placed below the connected ones** in rows of
  `max(maxX, 4 × 220 + 3 × isolatedGap)`, like the React reference does.
- **The result is only the coordinates.** The React reference returns
  `[{ id, x, y }]`; the SDK addresses the tables by their position in the
  input, which keeps the function free of the ids.
- **The inference reads the candidates from the names of the fields.** The
  React reference also compares the *type* of the foreign key with the type of
  the primary key; the SDK leaves that judgement to the user, who can reject
  the candidates in the dialog of Task 28.

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs layout` → 14/14 pass.
- Full workspace suite → 395/395 pass (was 381 before the task).
- `pnpm run typecheck` → clean (core, sdk, app, example, e2e).

## Environment

`pnpm --filter @drawdb/core add @dagrejs/dagre@3.1.1` failed with
`ERR_PNPM_UNEXPECTED_STORE`: `node_modules/.modules.yaml` still pointed at the
store of the old location (`drawdb/.pnpm-store`), which the restructure of the
repository moved into the SDK workspace. Patching the `storeDir` of
`node_modules/.modules.yaml` fixed it.

`@dagrejs/dagre@3.1.1` is an ESM package, so
`import { graphlib, layout } from "@dagrejs/dagre"` works in Node and in the
bundlers without an interop.
