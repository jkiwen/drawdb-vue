# The drag that follows the pointer

A table was picked with the left button and dragged and it did not move with the
pointer. The table stayed where it was and jumped to the place of the release
only when the button was let go, which reads as a canvas that ignores the drag.

This document records the cause, the fix and the contract that the drag of the
canvas follows now. The same path carries the drag of an area and of the tables
that sit inside it.

## The commits

| Commit | Content |
|---|---|
| `2fc5574` | The live preview of the drag for the tables and the areas, the release outside of the canvas, the cancel of the pointer, the one command of the release |

The fix was written in the working tree while the areas were being finished, and
the two changes touch the same files (`use-canvas-drag.ts`, `use-canvas-actions.ts`,
`use-canvas-handlers.ts`, `use-canvas-events.ts`), so they landed in the one
commit of the areas. The report of the areas does not repeat this one.

## The three causes

1. **The position was written once, at the release.** `use-canvas-actions.ts`
   computed `table.x + delta.x` inside `commitDrag()`, which the canvas called
   from `pointerup`. `use-drag.ts` tracked the movement, but no renderer read
   `dragState.delta`. A table is drawn with
   `:transform="translate(table.x table.y)"`, so a diagram that does not change
   during the drag draws a table that does not move.
2. **The release outside of the canvas was never seen.** `useCanvasEvents()`
   binds the pointer to the svg of the canvas. A drag that the user ended over a
   panel of the editor left `dragState.active` true, and the table kept the
   position of the last move of the pointer that the canvas had seen.
3. **A click recorded a move.** The old `commitDrag()` wrote every dragged table
   through `updateTable()` whatever the distance, so a plain click on a table
   added an entry of the history that moved nothing.

The reference implementation (`EditorCanvas/Canvas.jsx`) does the opposite of the
first cause: `handlePointerMove` writes the elements on every frame and
`handlePointerUp` pushes one `Action.MOVE` of the whole selection, only when the
pointer really travelled (`didDrag()`).

## The fix

**The drag lives in `use-canvas-drag.ts`.** `track()` keeps the positions of the
start of every element of the drag, `preview()` moves them to `origin + delta`,
`commit()` hands the drag to the actions and `cancel()` puts the elements back.
`use-canvas-handlers.ts` only routes the pointer: the `pointerdown` of a table or
of an area starts the drag, `pointermove` calls `preview()`, `pointerup` calls
`commit()` and `pointercancel` calls `cancel()`.

**The preview writes the coordinates, not the history.**
`previewTablePositions()` (of `stores/diagram.ts`) and `previewAreaPositions()`
(of `stores/element-actions.ts`) set `x` and `y` on the reactive elements without
a command and without bumping `revision`. The drawing follows the pointer because
the components read the diagram, and the autosave does not see a change because
`stores/save.ts` watches the revision.

**The release records one command.** `commitDrag(origins)` puts the elements back
where the drag started and then writes the final positions with `moveElements()`,
which records `UpdateTableCommand` and `UpdateEntityCommand` — or one
`CompositeCommand` when the drag moved several elements. The commands therefore
snapshot the position of the start as their previous state, so one undo returns to
it and an area comes back with the tables it held. A `delta` of zero is a click
and it writes nothing.

**The end of the gesture is heard on the window.** `use-canvas-events.ts` also
listens to `pointerup` and `pointercancel` on the window and forwards them to the
handlers unless the canvas has already handled them
(`target.contains(event.target)`), so a release above a panel of the editor still
ends the drag. `pointercancel` — what a touch screen sends when it takes the
gesture over — cancels the preview instead of committing it, and a cancelled
resize keeps the size it had.

## The contract

- A table and an area follow the pointer on every frame of the drag.
- The release records one entry of the history, wherever the pointer was released.
- One undo returns the elements of the drag — an area with the tables inside it —
  to the positions they had before the drag.
- A press and a release without movement records nothing.
- A cancelled pointer leaves the diagram as it was.

## The boundaries

- **The preview writes the diagram, and the commit is what makes it correct.** The
  intermediate positions exist in the model while the button is down, so anything
  that reads the diagram during the drag sees them: the minimap, the side panel
  and the drawing. That is the point of the change — a preview outside of the
  diagram would need a second path in every renderer — but it means the gesture
  has to end, which is what the window listener and the cancel of the pointer
  guarantee.
- **The drag of a group is one command, not one per frame.** `CompositeCommand`
  came with the areas and it is what the drag of several elements uses now; the
  description of that entry of the history is generic.
- **The grid snaps the start, not every frame.** `useDrag().beginDrag` snaps the
  origin to the grid and every frame moves by the raw delta, so a table keeps its
  offset inside the cell of the grid while it moves.

## The verification

- The suite passes: 603 specifications, including the four of the drag in
  `packages/sdk/src/components/Canvas/interactions/canvas-interactions.test.ts` —
  the table follows the pointer before the release, the undo returns to the
  start, a release outside of the canvas still commits, and a click records
  nothing.
- `pnpm run typecheck` passes for the core, the SDK, the application, the example
  and the e2e specifications.
- `pnpm run build:packages` passes.
- `e2e/areas.spec.ts` drives the same property in a real browser ("moves the area
  that is dragged" reads the box while the button is still down). Like the other
  e2e specifications it is not run in the sandbox of the development machine
  (the browser fails to spawn); the continuous integration runs it.
- The defect was reproduced and the fix was confirmed by hand in the example
  application: the table follows the pointer and the history records the drag
  once, on the release.
