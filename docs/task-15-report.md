# Task 15 — Physical/Logical View Mode

## Scope

The editor draws a table with its fields, its types and its constraints. The logical view
shows the business side of the model instead: the name of the entity, its description and
the cardinality of the relationships.

The task implements the two modes of the canvas:

- the **physical** view shows the fields of a table with their types,
- the **logical** view shows the entity (name and comment) and the cardinality of the
  relationships.

The mode is a property of the user interface store, so every component of the canvas
follows the same state, and the host application can control it through the `viewMode`
prop of `DrawDBEditor`.

## Dependencies

- Task 11 (canvas components): `Table.vue` and `Relationship.vue` are reused and adapted.
- Task 14 (DrawDBEditor): the `viewMode` prop and the menu entry are wired here.

## Changes

### `packages/sdk/src/stores/ui.ts`

The store holds the mode:

```ts
const viewMode = ref<ViewMode>("physical");

function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
}

function toggleViewMode() {
  viewMode.value = viewMode.value === "physical" ? "logical" : "physical";
}
```

`ViewMode` is the type of the public API (`"physical" | "logical"`), declared in
`packages/sdk/src/types/sdk-options.ts`.

### `packages/sdk/src/components/Canvas/geometry.ts`

The logical mode uses its own measures, because an entity box is smaller than a table
with its fields:

- `LOGICAL_TABLE_HEIGHT = 56`,
- `logicalTableBounds(table)` — the box of an entity,
- `logicalAnchor(table, side)` — the vertical middle of the entity box on the border
  that faces the other table,
- `logicalRelationshipAnchors(startTable, endTable)` and
  `logicalRelationshipBounds(startTable, endTable)`.

The physical helpers (`tableBounds`, `fieldAnchor`, `relationshipAnchors`, …) are
untouched.

### `packages/sdk/src/components/Canvas/LogicalTable.vue` (new)

The entity box: the name of the table and its comment, without the fields. It emits
`dragstart`, exactly like `Table.vue`, so that the drag of the canvas works in both
modes. The test id is `logical-table-<id>`.

### `packages/sdk/src/components/Canvas/LogicalRelationship.vue` (new)

The line between two entities with the two cardinality markers (one tick for "one",
three lines for "many") and the name of the relationship. The test id is
`logical-relationship-<id>`.

### `packages/sdk/src/components/Canvas/Table.vue` and `Relationship.vue`

Both components read the mode from the user interface store:

- `Table.vue` hides the type of a field when the mode is `logical` and the table is
  drawn with `showFieldTypes`. The type span carries the generic test id
  `field-type` and the id of the field in `data-field-id`.
- `Relationship.vue` attaches the relationship to the fields in the physical view and
  to the entities in the logical view.

### `packages/sdk/src/components/Canvas/Canvas.vue`

The canvas picks the components of the mode with `v-if` / `v-else` inside a
`<template v-for>`. The culling of the visible objects uses the logical bounds in the
logical mode, so that the objects that leave the screen disappear in both modes.

### `packages/sdk/src/components/DrawDBEditor.vue` and `Header/types.ts`

The `viewMode` prop of the editor sets the mode at the setup and a watcher follows
the later changes of the prop. The menu of the header gained the entry
`view:toggle-view-mode`, which calls `toggleViewMode()`.

## Differences from the plan

- The plan lists the store, `Table.vue` and `Relationship.vue` as the files to change
  and the two logical components as the files to create. The canvas itself
  (`Canvas.vue`), the barrel of the canvas and the header also needed a change, so
  that the mode reaches the drawing.
- The logical relationship is a separate component instead of a branch of
  `Relationship.vue`, so that the two modes stay independent.

## Tests

`packages/sdk/src/components/Canvas/view-mode.test.ts` — 8 specifications:

- the field types are shown in the physical view and hidden in the logical view,
- the entity is drawn with its name and its comment, but without its fields,
- the logical relationship keeps the cardinality markers,
- the physical relationship stays attached to the fields,
- the canvas draws the tables in the physical view and the entities in the logical view,
- the store switches between the two modes.

The spec installs the pinia as a plugin of the mounted application, like the
specification of the editor does: a store that is used without an installed pinia makes
pinia write a warning in development mode.

The whole suite of the workspace passes (289 specifications) and the type check of the
two packages is clean.
