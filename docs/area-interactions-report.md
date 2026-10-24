# The areas of the canvas

An area was drawn on the canvas and nothing else worked: the pointer that landed
on it cleared the selection and panned the canvas, the corner of an area had no
handle, and a selected area looked exactly like an unselected one. An area could
be selected from the side panel and from nowhere else.

This document records the cause, the work that made the areas behave like the
tables and the decisions that came with it.

## The commits

| Commit | Content |
|---|---|
| `2fc5574` | The selection, the resize and the drag of the areas, the tables that sit in an area follow it, `CompositeCommand` |

## The four causes

1. **The pointer bubbled out of the area.** `Area.vue` was a group of the SVG
   with no listener; the `pointerdown` reached the root of the canvas, which
   cleared the selection and started a pan. No click could ever land on an area.
2. **The area had no handle.** Only `Table.vue` rendered `ResizeHandles`, and the
   state of a resize named a table (`ResizeState.tableId`), so the canvas had
   nothing to draw in the corner of an area.
3. **The store wrote the other collection.** `addArea` used the generic
   `addEntity("areas", area)`, which creates an `areas` array with `??=`. A
   diagram that is imported keeps its areas in `subjectAreas`, so the first area
   added to such a diagram hid every area that the file had brought.
4. **The stylesheet drew no selected area.** There was no
   `.ddb-area.is-selected` rule, so a selected area and an unselected one had the
   same look.

## The interactions of an area

`Area.vue` is a group with a `pointerdown` that stops the propagation and emits
`dragstart`, the way `Table.vue` does. The `shift` key is left to the canvas: it
draws the selection box, and an area under the rectangle does not steal it from
the pointer. The handle is a second group in the corner of the area
(`data-testid="area-resize-handle-<id>"`), which stops the propagation of its own
`pointerdown` and emits `resizestart`; so the handle resizes the area instead of
moving it.

The canvas passes the `resizing` state down to the group, which draws the size of
the drag while the pointer moves. The store is written once, when the pointer is
released, so a drag of a corner is one entry of the history and not one per frame.

`ResizeState` carries a `kind` (`table` or `area`) and an `id` instead of a
`tableId`, and `useResize().begin` takes a `ResizeRequest`. The smallest size of
each kind lives in one table (`SMALLEST`): 120×60 for a table, **80×60** for an
area. An area stores the width and the height, because both of them are its own;
a table stores the width only, because its height follows its fields.

`commitResize` writes nothing when the handle was pressed without being dragged.
An area is compared with the size it has in the diagram, and a table with the
width it has (the default one when the diagram stores none), so that the history
does not record a change that does not exist.

## The actions of the store

`packages/sdk/src/stores/element-actions.ts` gathers the writes of the areas:
`addArea`, `updateArea`, `removeArea`, `previewAreaPositions` and `moveElements`.
`areaCollection(diagram)` answers `diagram.areas ? "areas" : "subjectAreas"`, the
collection that the getter `areas ?? subjectAreas` reads, so a write lands where
the next read looks for it — the third cause above.

The actions live in a file of their own because `diagram.ts` is at the limit of
300 lines that `scripts/verify-constraints.test.ts` enforces. The store spreads
the factory (`...elements`) next to `...sidePanel`, so every write keeps going
through the history and bumps the revision that the automatic saving and the
synchronization of the editors watch.

## The drag of a group

`use-canvas-drag.ts` holds the drag that `use-canvas-handlers.ts` used to hold
inline, for the tables and for the areas alike. `contentsOf(area)` collects the
tables whose top-left corner is inside the rectangle of the area, and the areas
inside it; `idsOfAreaDrag` adds them to the ids that the selection drags.

The containment is geometric and it is not stored. The `Area` and the `Table`
models have no field that links them, the reference application has no grouping
either, and `subjectAreas` is the shape of the JSON file. A diagram therefore
keeps its arrangement through a round trip of the JSON without a change of the
schema: an element belongs to the area it sits in, and dragging it out of the
rectangle is all it takes to leave.

`CompositeCommand` (in `@drawdb/core`) wraps the `UpdateTableCommand` and the
`UpdateEntityCommand` of the drag, so that one undo puts the area **and** the
tables back where they were. `moveElements` uses the single command when the
drag moved one element, which keeps the description of that change.

## The boundaries of the work

- **The area is drawn below the tables.** The canvas renders the areas first, so
  a pointer grabs the area only where no table covers it. The user moves an area
  by its free part. Raising an area above the tables would hide the tables.
- **A selected area does not take its tables when the keyboard deletes it.** The
  tables are not owned by the area, so they stay where they are; the empty area
  is what disappears.
- **A table belongs to the area that holds its top-left corner.** A table that
  hangs over the edge of the area but starts outside stays out. A geometric rule
  is the only one that a diagram can carry without a field of its own.

## The verification

- The suite of the commit passes: 561 specifications, including the new
  `packages/sdk/src/components/Canvas/area-editing.test.ts` (the selection, the
  highlight, the handle, the resize, the smallest size, the undo, the move, the
  tables that follow the area and the ones that do not).
- `pnpm run typecheck` passes for the core, the SDK, the application, the example
  and the e2e specifications.
- `pnpm run build:packages` passes.
- `e2e/areas.spec.ts` drives the same cases in a real browser. It is **not run**
  in the sandbox of the development machine: the spawn of the browser fails there
  (`spawn EPERM`). The continuous integration runs it.
