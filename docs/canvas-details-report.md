# The details of a table — the bugfix report

The 26th of October 2026. The report of the defect and its fix: the details
button of a table (the `⋯` of the header) opened a panel whose style did not
match the canvas, and the table never grew to fit it.

## The defect, as reported

> 表格视图中，detail 按钮点击后，表格内显示的信息样式与总体样式不符，同时表格的大小没有根据detail信息的内容而进行调整

## The commit

| Commit | Content |
|---|---|
| `4fcdcbc` | The details of a table open inside the table, share the edit style of the canvas, and the table grows to fit them |

## The causes, measured

1. **The details opened as an overlay, not as a part of the table.** The
   stylesheet pinned the panel to the header with `position: absolute;
   top: 100%`, so the panel was painted on top of the fields instead of
   pushing them down. The height of the table (`tableHeight`) only counted
   the header and the fields, so the `foreignObject` never made room: the
   table stayed 122 pixels high while the panel needed 148 more.
2. **The styles of the details were their own.** The panel hard-coded its
   colours and its font size, and the inputs of the indices and the unique
   constraints were native `<input>` elements whose classes had no rules at
   all, so the browser drew them with its default look — nothing like the
   flat edits of the fields.

## The fix

- **The open state is a fact of the table.** `Table` carries
  `details?: boolean`, the way it already carries `collapsed`. The geometry
  of the canvas is a set of pure functions of the model — the bounds, the
  anchors of the relationships and the culling all read the height of a
  table — so the open state has to live in the model for the geometry to
  see it.
- **The height of the details is exact.** `table-details-geometry.ts`
  holds the constants and `tableDetailsHeight(table)`: the padding (2×8),
  the colour row (28), the two section titles (2×24), one row per index
  and unique constraint (28 each) and the two buttons that add them
  (2×28). `tableHeight` adds it, and the bounds, the anchors and the
  culling follow on their own.
- **The details sit in the flow of the body.** The `⋯` button of the
  header emits `toggledetails`, and the table renders the panel between
  the header and the fields. The height of the table is computed from the
  table of the store (`liveTable`) and not from the prop, so the table
  grows the moment the store records the change.
- **The panel looks like the rest of the canvas.** The inputs are the
  inputs of the library, tiny and flat, sharing the edit style of the
  fields (the transparent border, the inherited type); the section titles
  are micro labels in capitals; every row has the fixed height the
  geometry counts on.
- **A locked table can show its details, and only show them.** The toggle
  bypasses the guard of the lock the way the lock toggle itself does —
  the lock stops changes, not looking — and the panel disables its inputs
  and hides its buttons while the table is locked.
- **The buttons that add an index tolerate a table without any.** A table
  added to the diagram carries no array of indices, and spreading
  `undefined` threw inside the handler, so the click did nothing. The
  handlers read `?? []` now — the regression was caught by
  `table-editing.test.ts`, which seeds exactly such a table.

## The tests

`table-details.test.ts` holds the five tests of the fix, all of them red
before it:

1. the height of a table grows with the details it shows (0 while closed,
   148 + 28 per row while open);
2. the details sit in the body of the table, not inside its header;
3. the `foreignObject` of the table grows to the height of the table with
   the details open;
4. the inputs of the details carry the edit style of the canvas;
5. a locked table shows its details read-only: the inputs are disabled and
   the buttons that add an index or a unique constraint are gone.

The two specifications of `table-editing.test.ts` that edit an index and a
unique constraint through the panel kept passing.

## The verification

- The unit suite is green: 727 tests, 0 failures (67 suites; the rule that keeps
  every file under 300 lines included — the details geometry and the
  toggles live in files of their own).
- The type check is clean.
- The end to end suite is green: 51 of 51.
- The build is green: 4 of 4.
- A probe in a real browser measured the table: 122 pixels closed, 270
  with the details open (+148, exactly the height of an empty panel), 298
  after adding an index (+28, exactly one row); the panel ends inside the
  box of the table. The screenshots are
  `docs/ui-ux-shots/canvas-details-fixed.png` (the canvas) and
  `docs/ui-ux-shots/canvas-details-panel.png` (the panel alone).

## The rulings

- **The open state of the details is model state, not component state.** A
  local `ref` of the header could not reach the pure geometry, and a second
  store would split the truth of the diagram. Cost if wrong: the height of
  the table and the panel disagree whenever the two states drift apart.
- **The rows of the details have a fixed height.** The geometry has to
  know the height of the panel before it is rendered, and a fixed height
  per row is the price of an exact answer. Cost if wrong: a row that needs
  more room has to get a constant of its own in
  `table-details-geometry.ts` and a rule of the same height in
  `canvas.css`.
- **The lock stops changes, not looking.** Hiding the details of a locked
  table would hide a part of the diagram the user asked to see. Cost if
  wrong: none — the edits stay guarded by the store and by the disabled
  inputs.
