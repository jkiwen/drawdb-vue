# Task 9 — Build Pinia Stores

**Status:** complete
**Plan:** `docs/plan.md:554-606`
**Commit:** `feat(sdk): add pinia stores`

## Scope

Create the state layer of `@drawdb/vue-sdk`. The SDK replaces the 14 React
contexts of the original app with five Pinia stores:

| Store | File | Responsibility |
| --- | --- | --- |
| `useDiagramStore` | `packages/sdk/src/stores/diagram.ts` | The edited diagram, all mutations recorded as commands |
| `useHistoryStore` | `packages/sdk/src/stores/history.ts` | Undo/redo, wraps the core `CommandManager` |
| `useUIStore` | `packages/sdk/src/stores/ui.ts` | Selection, viewport, panel state |
| `useSettingsStore` | `packages/sdk/src/stores/settings.ts` | User preferences, mirrored into `localStorage` |
| `useSaveStore` | `packages/sdk/src/stores/save.ts` | Persistence through an injected `StorageAdapter` |

`packages/sdk/src/stores/index.ts` re-exports all five.

## Diagram store

The diagram is held in a `reactive()` object rather than a `ref`, because the
core commands mutate the diagram in place. A reactive proxy lets those
mutations trigger Vue reactivity without the store having to copy the diagram
around.

Every mutation goes through the history store:

```
store.addTable(table)            → history.execute(new AddTableCommand(...))
store.updateTable(id, updates)   → history.execute(new UpdateTableCommand(...))
store.removeTable(id)            → history.execute(new RemoveTableCommand(...))
store.addRelationship(rel)       → history.execute(new AddRelationshipCommand(...))
store.updateRelationship(...)    → history.execute(new UpdateRelationshipCommand(...))
store.removeRelationship(id)     → history.execute(new RemoveRelationshipCommand(...))
store.addField(tableId, field)   → history.execute(new AddFieldCommand(...))
store.updateField(...)           → history.execute(new UpdateFieldCommand(...))
store.removeField(...)           → history.execute(new RemoveFieldCommand(...))
store.addEntity(collection, e)   → history.execute(new AddEntityCommand(...))
store.removeEntity(collection,id)→ history.execute(new RemoveEntityCommand(...))
```

A `revision` counter is bumped on every change. The save store watches it
synchronously (`flush: "sync"`) to maintain the dirty flag, which keeps the
flag correct even when a change and the following save happen in the same
tick.

`setDiagram()` replaces the whole diagram and clears the undo history.

## Core additions

The core command vocabulary was missing four commands that the store needs;
they follow the pattern of the existing ones:

- `packages/core/src/commands/add-field.ts` — `AddFieldCommand`
- `packages/core/src/commands/remove-field.ts` — `RemoveFieldCommand`
- `packages/core/src/commands/update-relationship.ts` — `UpdateRelationshipCommand`
- `packages/core/src/commands/remove-relationship.ts` — `RemoveRelationshipCommand`

`packages/core/src/commands/add-entity.ts` adds two generic commands,
`AddEntityCommand` and `RemoveEntityCommand`, that cover the flat diagram
collections (`notes`, `areas`, `subjectAreas`, `types`, `enums`, `views`).
Entities are identified by `id`, falling back to `name` for enums.

## Reactivity-safe cloning

`structuredClone` refuses to serialise the proxy objects a reactive framework
hands out ("structuredClone FAILED: #<Object> could not be cloned"). Two core
places would therefore have thrown as soon as a reactive diagram reached them:

- `UpdateTableCommand` and `UpdateFieldCommand` snapshot the previous state.
- `cloneDiagram()` in the storage layer clones a diagram before storing it.

`packages/core/src/utils/clone.ts` adds a framework agnostic `deepClone()` that
walks plain objects, arrays and dates by hand and therefore also works on
proxies. Both commands and `cloneDiagram()` use it now.

## Environment work

**Cross-package imports.** The SDK imports `@drawdb/core`, but the sandbox
cannot build the workspace packages, and Node refuses to strip TypeScript
types for files under `node_modules`, which rules out the plain workspace
symlink. `scripts/ts-resolver.mjs` is a Node resolve hook that remaps
`@drawdb/core` to `packages/core/src/index.ts`; `scripts/run-tests.mjs`
registers it with `module.registerHooks()`. The hook is test infrastructure
only — production builds resolve the published package as usual.

**pnpm.** `pnpm 11.28.5` ignores the `pnpm` field of `package.json`, so the
allow-list for build scripts was moved to `pnpm-workspace.yaml`
(`onlyBuiltDependencies`). Build scripts must stay skipped: running them makes
the install fail with `EPERM ... spawn`, because the sandbox blocks child
processes with piped stdio. Use `pnpm install --ignore-scripts`.

With the hoisted linker the transitive dependencies of a workspace package are
not reachable from it, so `vue-demi` and `@vue/devtools-api` (both required by
`pinia`) are declared as explicit dependencies of `@drawdb/vue-sdk`. The
`pnpm` field of the root `package.json` was removed to silence the warning.

**Untyped dependency.** TypeScript prefers a resolvable but untyped JavaScript
module over an ambient module declaration, so `declare module
"oracle-sql-parser"` in `packages/core/src/types/vendor.d.ts` stopped working
once the package was actually installed. The declaration moved to
`packages/core/src/types/oracle-sql-parser.d.ts` and is mapped onto the
specifier through a `paths` entry in the TypeScript configuration of both
packages.

## Tests

`packages/sdk/src/stores/diagram.test.ts` — 10 specs, all passing:

- adding a table grows the diagram and is recorded in the history store
- undo and redo restore the previous state
- updating a table restores name and position on undo
- removing a table also removes its relationships and undo brings both back
- adding, updating and removing fields
- adding, updating and removing relationships
- notes, areas, enums and views through the generic entity commands
- `setDiagram()` replaces the content and clears the history
- the revision counter advances on every change

Verification: `node --experimental-strip-types scripts/run-tests.mjs` →
199/199 workspace specs pass (189 before this task, 10 new);
`pnpm run typecheck` → clean for `@drawdb/core` and `@drawdb/vue-sdk`.

## Differences from the plan

- The plan's test snippet uses `vitest`; the sandbox cannot run vitest
  (`EPERM` on the esbuild child process), so the spec uses `node:test` and is
  executed by the workspace test runner.
- The plan describes five stores; the file list is implemented as written.
- The spec (`docs/spec.md:369-421`) shows a `ref<Diagram>` and a command
  interface with `id`/`type`. The implemented core command interface is
  `{ execute, undo, redo?, description }` and the diagram is a `reactive`
  object, which is what makes in-place command mutations observable.
