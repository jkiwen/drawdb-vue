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
| `f56c6f3` | The collapse, the lock and the details of an area, the membership rule of the overlap and the five defects of the areas |

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

## The collapse of an area

An area carries an optional `collapsed` flag in `packages/core/src/models/area.ts`,
next to `color`. The flag survives the diagram JSON round-trip (the exporter and
the importer pass the areas wholesale) and therefore the IndexedDB storage, so a
collapsed area stays collapsed across a reload — the persistence is the diagram
itself, not a separate local storage.

`Area.vue` reads `collapsed` to draw only the title bar: the rectangle is 28px
high (`COLLAPSED_HEIGHT`), the resize handle is not rendered, and the stored
width and height of the diagram are left untouched, so an expand restores the
exact size the area had. The toggle is a third group in the top-right corner
(`data-testid="area-toggle-<id>"`, `role="button"`) with a chevron that points
down when the area is open and rotates −90° when it is collapsed; the height of
the rectangle and the rotation of the chevron are CSS transitions, so the fold
animates without a store write per frame.

The group stops the propagation of its own `pointerdown` and emits
`togglecollapse`; the canvas answers with `updateArea(id, { collapsed: !collapsed })`,
one undoable command per click — an undo restores the previous state of the flag,
and the state of each area is its own, so collapsing one area leaves the others
open.

A collapsed area hides what it holds: `heldByCollapsedArea` in
`packages/sdk/src/utils/elements.ts` applies the membership rule of the drag (the
start corner of the element sits in the rectangle of the area), and
`useCanvasItems` keeps the tables, the notes and the views a collapsed area holds
out of the drawing, together with the relationships that touch a hidden table.
The elements are filtered before the virtualization, so they are not drawn and
cannot be clicked while the area is folded; an expand draws them again, at the
places they never left.

A relationship that connects a table inside the collapsed area to a table
outside of it folds with the area, but it is not lost to the user: a badge on
the title bar (`data-testid="area-link-badge-<id>"`) counts these
relationships, and the hover on the badge draws each of them as a dashed line
to the table outside. `collapsedAreaLinks` in `use-canvas-items.ts` collects
the targets, `AreaLinkBadge.vue` draws the badge and the lines.

## The lock of an area

An area carries an optional `locked` flag, like a table and a note do. The
title bar carries a padlock (`data-testid="area-lock-toggle-<id>"`) whose
shackle is closed on a locked area and open on an unlocked one; a locked area
draws its border dashed, the way a locked table does.

The lock is complete: a locked area cannot be moved, resized, edited or
removed, and the lock extends to the elements the area holds.
`heldByLockedArea` in `packages/sdk/src/utils/elements.ts` applies the same
membership rule as the collapse, and the store treats a table a locked area
holds as a locked table (`isLocked`), so every change of it is refused — the
move, the resize, the edit of a field, the drawing of a relationship — in the
canvas and in the side panel alike. The notes follow the same rule in
`element-actions.ts`.

The toggle is the one write that still goes through: `updateArea` refuses
every update of a locked area except the one that only touches `locked`
(`onlyTogglesLock`), so the padlock can unlock the area again. The lock is a
command like every other change, so it is undoable, and it survives the
diagram JSON round-trip like `collapsed` does.

## The details of an area

The title bar carries a pencil (`data-testid="area-details-toggle-<id>"`) that
opens a panel in the canvas, below the title bar (`AreaDetails.vue`, a
`foreignObject` with native inputs, the way `Note.vue` edits a note). The
panel edits the name, the description, the color and the opacity of the
background; the openness is a state of the canvas, not of the diagram, so it
is not saved and a click on the empty canvas closes the panel.

The name and the description are committed when the field loses the focus,
validated by `validateAreaProps` like the side panel does, so a rename is one
undoable step. The color and the opacity apply as soon as the picker closes:
`Area.vue` draws the fill as `withOpacity(color, opacity)` (default 0.08) and
keeps the stroke at the full color, so the border of the area stays visible
with a very light fill. The opacity is a new optional field of the `Area`
model. A locked area disables the fields of its panel.

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
- **An element belongs to an area when the two rectangles overlap.** The rule
  was the corner of the element until the defects of the twenty sixth of
  October 2026 showed that it was the wrong rule: a table that is drawn inside
  an area and hangs over its edge was not folded with the area, and it did not
  travel with it either. The rule of the overlap answers the question of the
  user — an element that lies in an area belongs to it — and it still needs no
  field in the model, so the diagram keeps its arrangement through a round trip
  of the JSON.

## The five defects of the areas (the twenty sixth of October 2026)

The user found five defects in the areas of the canvas. Every cause was
measured in a real browser before a line of code was written, and every fix is
covered by a specification that failed before it.

1. **A collapsed area left its tables and its notes on the canvas.** The
   membership rule of the collapse was the corner of the element, so a table
   whose body lay in the area but whose corner hung outside of it stayed
   visible on the folded area.
2. **The tables of an area did not travel with it.** The rule of the drag was
   the same corner rule, so a table that lay in the area was left behind when
   the area was moved.
3. **The notes of an area did not travel with it.** `contentsOf` collected the
   tables and the areas, but not the notes.
4. **A relationship that reached out of a collapsed area was lost.** The
   relationship was hidden with the area that held one of its ends, and nothing
   told the user that it was still there. The badge on the title bar counts
   these relationships now, and the hover on the badge draws a dashed line to
   the table outside.
5. **The details panel of an area was drawn over the canvas and the area could
   not be grabbed any more.** The panel hung over the area and caught the
   presses that should have moved it.

The membership rule was therefore changed once, in `areaHolds` in
`packages/sdk/src/utils/elements.ts`: the rectangle of the element and the
rectangle of the area have to overlap. The rule is used by the collapse, by the
lock and by the drag, so all three of them answer the same question the same
way. `areaHoldsElement` wraps it with the shape of the element (the size of a
table follows its fields, the size of a note and of a view is the one they
store), so that the rule reads the truth of the drawing.

The specifications of the defects are in
`packages/sdk/src/components/Canvas/area-defects.test.ts` (the fold of the
tables and of the notes, the tables and the notes that travel with the area, the
relationship that reaches out and the badge that counts it, the panel that
hangs below the area and the press that does not drag the area).

## The verification

- The suite passes: 727 specifications, including the new cases of
  `area-editing.test.ts` (the lock and its extension to the tables, the
  refusal of the updates and of the delete, the details panel, the badge of a
  collapsed area), the new units of `elements.test.ts`
  (`heldByLockedArea`, `withOpacity`) and the new specification of the
  defects, `area-defects.test.ts`.
- `pnpm run typecheck` passes for the core, the SDK, the application, the
  example and the e2e specifications.
- `pnpm run build:packages` passes (45 components).
- The collapse was measured in a real browser against the example harness: the
  canvas held 12 tables, the collapse of the area hid 5 of them and showed the
  badge of the relationships that reach out of the area, and the expand brought
  the 12 tables back at the places they never left. No page error.
- `e2e/areas.spec.ts` drives the same cases in a real browser. It is **not run**
  in the sandbox of the development machine: the spawn of the browser fails there
  (`spawn EPERM`). The continuous integration runs it.
