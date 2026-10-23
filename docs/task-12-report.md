# Task 12 Report: Build Header Components

## Scope

Replaces the 2,509-line React `ControlPanel` with four focused Vue components in
`packages/sdk/src/components/Header/`:

| File | Responsibility |
| --- | --- |
| `Header.vue` | Composes the header: menu bar, title, database selector, toolbar, save state, undo/redo. |
| `MenuBar.vue` | Data driven menu bar; reports the selected entry through a `select` event. |
| `Toolbar.vue` | Creates tables, notes and areas and controls the canvas (zoom, grid, side panel). |
| `UndoRedoButtons.vue` | Undo and redo buttons, bound to the history store. |
| `types.ts` | The shape of the menu bar and the default entries. |
| `index.ts` | Barrel of the header components. |

Supporting changes outside of the header:

- `packages/core/src/commands/update-diagram.ts` — new `UpdateDiagramCommand`, which
  changes the top level properties of a diagram (title, database, SQL header) and can be
  undone. It is exported from the core barrel.
- `packages/sdk/src/stores/diagram.ts` — new `updateDiagram(updates)` action that records the
  command in the history store; `addEntity` now accepts the full shape of an entity, so that
  notes and areas can be created.
- `packages/sdk/src/utils/elements.ts` — factories for the elements the editor creates
  (`createTable`, `createNote`, `createArea`, `createRelationship`, `uniqueTableName`).
- `packages/core/src/storage/indexeddb-adapter.ts` — the IndexedDB factory is now resolved
  from `globalThis.indexedDB` **or** `globalThis.window.indexedDB`, so that the adapter also
  works in environments that emulate a browser (see the tests below).

## Dependencies

- Naive UI `^2.38.0` for the buttons, the input, the select, the tag and the dropdowns.
- The stores of Task 9 (`useDiagramStore`, `useHistoryStore`, `useUIStore`, `useSaveStore`).
- `@vue/test-utils` and `jsdom` for the component specs.

## Differences from the plan

- The plan describes the spec with vitest and `@vue/test-utils`' `mount`. vitest cannot run in
  this sandbox, so the specs use the `node:test` runner of the workspace and `mount` of
  `@vue/test-utils`, which works now that the runner installs a jsdom document.
- The plan does not mention a title, a database selector or a save indicator. They are part of
  the header of the original React control panel, so they were added, and the change of the
  title and of the database is undoable.
- The plan does not name the elements the toolbar creates. `utils/elements.ts` keeps the
  defaults of the new tables, notes and areas in one place.

## Environment work

- Naive UI mounts its styles into the document, so it needs a DOM. `scripts/dom.mjs` installs a
  jsdom document before the spec files are imported, and `scripts/run-tests.mjs` calls it.
- The `NDropdown` of Naive UI takes its trigger in the **default** slot, not in a `trigger`
  slot. A `<template #trigger>` produces an empty trigger and the dropdown does not render.
- Naive UI puts the fallthrough attributes (for example `data-testid`) on the root element of
  the component, so the text field of the title is found as
  `[data-testid="diagram-title-input"] input`.
- `jsdom` needs `lru-cache@^11`, which is declared explicitly for the same reason as in
  Task 9: the hoisted pnpm linker does not expose the transitive dependencies of a package.
- `fake-indexeddb/auto` installs its implementation on `window` when a window exists, so the
  IndexedDB adapter looks at both places.

## Tests

`packages/sdk/src/components/Header/Header.test.ts` — 10 specs:

1. renders undo and redo buttons
2. undo and redo are disabled while the history is empty
3. undo becomes available after a change and applies it
4. the toolbar creates tables, notes and areas
5. a new table gets a unique name and becomes the selection
6. the zoom buttons change the zoom of the canvas
7. the grid and the side panel can be toggled
8. the menu bar shows the default groups and reports a selection
9. the title of the diagram is shown in the header
10. the database of the diagram is shown in the header

Workspace suite: 253/253 specs pass. `pnpm run typecheck` is clean.
