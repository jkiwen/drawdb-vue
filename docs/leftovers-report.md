# The leftovers of the last stage are closed

The stage that closed the three leftovers of P8 (the canvas that reads the logical
domains, the history the user can jump through, the outline that names a
relationship after the layer it shows) left a handful of loose ends behind. This
report is the closure of the stage: what was checked, what was built, and what the
gates said.

## The leftovers that were checked again

The three items of the previous stage were closed by the commits `b09108b`,
`7444760`, `41604cd`, `01112dd`, `2d5cbdb` and `a8c621a`. They were not written
again; their behaviour and their contract were checked against the suites that
cover them:

- the canvas resolves a domain with the rule of the core
  (`packages/sdk/src/components/Canvas/canvas-domains.test.ts`,
  `table-domains.test.ts`),
- the history jumps to a step and says whether it landed there
  (`packages/core/src/commands/command-manager.test.ts`,
  `packages/sdk/src/stores/history.test.ts`),
- the outline names a relationship after the layer the tree shows
  (`packages/sdk/src/components/Outline/outline-labels.test.ts`,
  `outline-actions.test.ts`).

## The custom types of the diagram leave Postgres with their names

`packages/core/src/export/postgres.ts` carried the last TODO of the sources:
the materialisation of `diagram.types` is a Postgres business, and the inline
versus materialised choice with its provenance markers belong to a later phase.
What was wrong in the meantime was not the choice but the names: the export wrote
the custom types under a quoted name (`CREATE TYPE "Address"`) while every
reference to them was written bare (`"addr" Address`), so a name that is not a
bare lower case identifier did not survive the export.

The new module `packages/core/src/export/postgres-types.ts` holds the two pieces
of the answer:

- `buildTypeNameResolver(diagram, isBuiltin)` finds the name of the diagram a raw
  type name points at. The lookup ignores the case, and `isBuiltin` is asked
  first, so a custom type called `text` does not take the place of the type of
  the dialect;
- `materialiseCustomType(type, resolve)` writes the `CREATE TYPE` of a custom
  type, and a field that names another custom type is written with the quoted
  name of that type.

The exporter uses the resolver for the columns as well, so a column and the type
it uses carry the same name. The TODO is replaced by the statement of the
boundary: the choice between inlining and materialising a type, and the markers
that carry the origin of a type, are the work of the next phase.

The tests are `packages/core/src/export/postgres-types.test.ts` (six cases) and
four new cases of `packages/core/src/export/postgres.test.ts`.

## The side panel speaks the language of the user

The tabs of the side panel wrote English into the interface while the locales of
the package carried the words already: the empty state of the notes tab said
"No notes" in every language, the button of the custom types tab said "Add
Custom Type", and the placeholders of the tables tab were English as well.

The tabs now read their words from the locale (`no_custom_types`, `no_notes`,
`no_relationships`, `no_views`, `no_areas`, `add_enum`, `add_custom_type`,
`search`, `name`, `type`, `add_field`, `untitled_note`). The two keys that were
missing (`no_areas` and `untitled_note`) are translated in every one of the 51
language files, not copied from English.

The test is `packages/sdk/src/components/SidePanel/side-panel-locales.test.ts`:
the empty states and the buttons carry the words of the locale, and they follow
the locale of the user when it changes.

## The verification

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | clean (core, SDK, application, example, e2e) |
| `node --experimental-strip-types scripts/run-tests.mjs` | 1441 tests, 1441 pass, 0 fail (1428 before this stage) |
| `no sdk file is longer than 300 lines`, `no app file is longer than 300 lines` | pass (`TablesTab.vue` is at 298 lines) |
| `@drawdb/core` and `@drawdb/vue-sdk` build | OK (built one by one: turbo cannot fork a child process in this sandbox) |
| `drawdb-vue-app` build | the type check passes; the bundling of vite cannot run here (esbuild is spawned, the sandbox denies it: `spawn EPERM`) |
| `pnpm run e2e` | not runnable here: Playwright cannot fork its worker (`spawn EPERM`); the suite still holds 55 cases |

## The commits of this stage

| Commit | What it carries |
| --- | --- |
| `feat(core)` | the custom types of the diagram leave the Postgres export with their names |
| `fix(sdk)` | the side panel speaks the language of the user |
| `docs(sdk)` | the ledger and this report |
