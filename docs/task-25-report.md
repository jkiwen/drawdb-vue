# Task 25 — sdk 画布拆分与交互层（canvas and interactions）

**Plan:** `docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md` → Task 25
**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md` → §5, §6

## Scope

The canvas of the SDK was one component with 360 lines, and the editor was one
component with 535 lines. Both were split, and the interaction layer of the
canvas (the link that the user draws, the rectangle that selects several
tables, the resize of a table and the menu of the right button) was added.

| File | Content |
| --- | --- |
| `packages/sdk/src/components/Canvas/TableHeader.vue` | the header of a table: the name, the comment and the colour strip |
| `packages/sdk/src/components/Canvas/TableField.vue` | one row of a table: the name, the marks of the primary key and of the not null, the type |
| `packages/sdk/src/components/Canvas/FieldHandle.vue` | the anchor on the right edge of a field; it starts a link |
| `packages/sdk/src/components/Canvas/ResizeHandles.vue` | the handle in the lower right corner of a table |
| `packages/sdk/src/components/Canvas/ContextMenu.vue` | the menu of the right button (Naive UI `NDropdown`) |
| `packages/sdk/src/components/Canvas/Minimap.vue` | the small overview of the diagram |
| `packages/sdk/src/components/Canvas/logical-geometry.ts` | the geometry of the logical view (moved out of `geometry.ts`) |
| `packages/sdk/src/components/Canvas/interactions/interaction-state.ts` | the types the store and the composables share |
| `packages/sdk/src/components/Canvas/interactions/use-linking.ts` | the state machine of a relationship the user draws |
| `packages/sdk/src/components/Canvas/interactions/use-selection-box.ts` | the rectangle that selects several tables |
| `packages/sdk/src/components/Canvas/interactions/use-resize.ts` | the resize of a table |
| `packages/sdk/src/components/Canvas/interactions/use-context-menu.ts` | the state of the menu of the right button |
| `packages/sdk/src/components/Canvas/interactions/use-canvas-commands.ts` | the commands of the menu of the canvas |
| `packages/sdk/src/components/Canvas/interactions/use-canvas-actions.ts` | the changes the user makes, written through the history |
| `packages/sdk/src/components/Canvas/interactions/use-canvas-handlers.ts` | the pointer handling of the canvas |
| `packages/sdk/src/composables/use-canvas-items.ts` | the visible items of the canvas (the virtualisation moved out of the component) |
| `packages/sdk/src/composables/use-canvas-interactions.ts` | the four composables of the interaction layer, synchronised with the store |
| `packages/sdk/src/components/EditorLayout.vue` | the layout: the header, the side panel and the canvas |
| `packages/sdk/src/components/EditorDialogs.vue` | the host of the dialogs (Task 28 fills it) |
| `packages/sdk/src/composables/use-editor-commands.ts` | the commands of the editor (the menu, the save, the import and the export) |
| `packages/sdk/src/composables/use-editor-plugins.ts` | the life cycle of the plugins |
| `packages/sdk/src/composables/use-editor-sync.ts` | the synchronisation with the props of the host application |
| `scripts/verify-constraints.test.ts` | the check that no file of the SDK is longer than 300 lines |

## The interaction layer

- `useLinking` holds the state of a link that is being drawn. `start` remembers
  the source field, `move` follows the pointer, `finish(target)` builds the
  relationship and `cancel` drops it. The composable **never** changes the
  diagram: the canvas stores the result with the `AddRelationshipCommand` of the
  core, so that the user can undo it.
  - A link that ends on the canvas (`finish()` without a target) is cancelled
    and produces nothing.
  - A link that ends on a table without a field ends on the first primary key
    of that table.
  - The name of the relationship is `fk_<table>_<field>_<table>`, the
    cardinality is `one_to_one` when the source field is unique and
    `many_to_one` otherwise.
- `useSelectionBox` holds the rectangle; `idsIn(rect, tables)` returns the ids
  of the tables the rectangle touches.
- `useResize` holds the size of the table that is being resized; the smallest
  size is 120 × 60.
- `useContextMenu` holds the position and the target of the menu.
- `useCanvasInteractions` owns the four composables and mirrors their state
  into the store of the interface, so that a host application can react to it.
- `useCanvasHandlers` owns the pointer handling: the drag of a table, the link,
  the rectangle, the resize, the pan and the wheel. It never touches the
  diagram itself — it asks `useCanvasActions` to write the result.

## The split of the editor

`DrawDBEditor.vue` keeps the props, the events and the assembly (246 lines).
The behaviour moved into three composables:

- `useEditorCommands` — the menu of the header, the save, the import, the
  export and the automatic saving.
- `useEditorPlugins` — the `PluginManager`, the `MetadataRegistry`, the slots
  and the commands of the plugins.
- `useEditorSync` — the controlled mode, the database, the view mode, the
  custom types, the storage adapter, the locale and the selection.

`EditorLayout.vue` draws the header, the side panel and the canvas.
`EditorDialogs.vue` is the empty host of the dialogs of Task 28.

## The differences from the plan

- **The two editor composables live in `composables/`, not in `components/`.**
  The plan listed `packages/sdk/src/components/use-editor-commands.ts`; they
  are behaviour and not markup, so they live next to the other composables.
- **The specifications of the interaction layer are split in two files.**
  `interactions.test.ts` holds the thirteen specifications of the composables,
  `canvas-interactions.test.ts` the eight specifications that mount the
  canvas. The constraint check counts the test files as well, and one file
  with all the specifications would have been longer than 300 lines.
- **The state of the menu of the right button exists twice.** The store of the
  interface keeps the state of the menu in the shape it had before (the target
  of a table carries its `id`), the interaction layer keeps the target of the
  canvas (the target of a table carries its `tableId`). The composable
  `useCanvasInteractions` translates the one into the other. The type of the
  canvas was renamed to `CanvasContextMenuState`, so that the two do not clash
  in the barrel of the package.
- **`Canvas.vue` is 163 lines and `DrawDBEditor.vue` 246 lines** — both below
  the limits of the plan (200 and 250).

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs interactions` → 21/21
  pass (13 specifications of the composables, 8 of the canvas).
- Full workspace suite → 452/452 pass (was 428 before the task).
- `pnpm run typecheck` → clean (core, sdk, app, example, e2e).
- `pnpm run build:packages` → the core and the SDK build (29 components).
- The constraint check reports no file of the SDK or of the application that is
  longer than 300 lines.
