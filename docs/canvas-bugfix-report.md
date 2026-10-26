# The five bugs of the canvas

The report of the five defects of the canvas that were reported on the 25th of
October 2026. Every cause was measured in a real browser before a line of code
was written, every fix is covered by a test that failed before it, and every
result was checked again in the browser.

The five reports, in the words of the report:

1. "table视图上的锁定按钮锁定后，仍然可以进行编辑" — a table that the user locked could still be edited.
2. "table 视图field进入编辑状态，填充满了table视图中的field区域，数据类型部分被遮挡" — the edit of a field filled the whole row of the field and hid the type.
3. "table 视图 数据类型部分无法进行编辑" — the type of a field could not be edited.
4. "table 视图 字段编辑显示为文本框方式，样式生硬，编辑状态应与正常显示一致，适当使用背景色改变即可" — the edit of a field looked like a text box; it should look like the field it replaces, with at most a background colour.
5. "note 增加后，无法改变大小，无法拖动，无法输入内容，修改时注意样式" — a note could not be resized, could not be dragged and could not be written in.

## The commits

| Commit | Content |
|---|---|
| `465903a` | The lock of a table is read by the store and by the panel of the sidebar, the edit of a field keeps the style of the field, and a note is an element of the canvas |
| `7bfc902` | The type of a field is reachable: the marks of the field keep their own place in the row, so the hover of the row does not take the type away |

## The first cause: the lock was only a picture

The lock of a table was drawn, and the button that sets it did reach the store,
but nothing read it back. `Canvas/Table.vue` checked `props.table.locked` in one
single place — the handler that starts a relationship — while the drag of the
table, the selection of a field, the resize and the reordering of the fields all
went through. `TableField.vue` and `TableHeader.vue` never heard of the lock, so
the edit of a name or of a type was always possible.

Worse, the store accepted the change: `diagram.updateTable("users", { name:
"accounts" })` on a locked table succeeded. The sidebar writes to the same
table, so a guard in the component alone would not have been enough.

The fix is in the store, where every change of a table goes through:
`isLocked(tableId)` refuses `updateTable`, `previewTablePositions`, `addField`,
`updateField`, `removeField`, `moveField` and `resizeTable`. The components
refuse it too, so that the user does not get a field that looks editable and
does nothing: `Table.vue` refuses the drag, the resize, the selection and the
reordering, and it hands the `locked` flag down to `TableHeader.vue` and
`TableField.vue`, which refuse to open an edit, to toggle the primary key and to
remove the field.

The browser confirms it: the button appears when the pointer is over the header
of the table, the click locks the table (`the table is locked: { locked: true,
button: '🔒' }`), and the edit of the name of a field does not open any more.

The panel of the sidebar says it as well. A locked table is drawn as a table
that cannot be changed: the inputs are disabled, the button that deletes the
table is gone and a tag says that the table is locked. A panel that looks
editable while nothing happens is worse than a panel that says the table is
locked.

```
before the lock: { theNameDisabled: false, theFieldDisabled: false, theDelete: true, theAddField: true, theLockedTag: null }
after  the lock: { theNameDisabled: true,  theFieldDisabled: true,  theDelete: false, theAddField: false, theLockedTag: "Locked" }
```

## The second cause: the type of a field was the name of a field

The input of the type carried the same class as the input of the name,
`ddb-table__field-input`, and `canvas.css` gives that class `flex: 1 1 auto`.
Inside the row of a field the type grew until it had taken the whole area of
the marks:

```
before the edit   the type box { x: 511.5, w: 38.5 }   the marks box { x: 495.5, w: 54.5 }
after  the edit   the type box { x: 401,   w: 149 }    the marks box { x: 385,   w: 165 }
```

The name of the field was pushed out of the row, and the key and the question
mark of the field were covered.

The name and the type now carry a class of their own —
`ddb-table__field-name-input` and `ddb-table__field-type-input` — and the type
holds its place in the row: `flex: 0 1 auto; width: 72px; max-width: 72px`.

## The third cause: the hover of the row took the type away

The fix above was not enough, and the browser said so: a double click on the
type of a field still opened the input of the **name**. The unit test did not
see it, because it drives the component and not the pointer.

The measurement shows a cycle that no one had seen:

```
the row is not hovered   the type is there      the type is at x 527
the pointer comes        the row is hovered     the type is GONE
                         the name grows from 95 to 162 pixels
                         the marks shrink to the 16 pixels of the remove button
```

`TableField.vue` drew the button that removes the field as `v-if="hovered"` and
the marks of the field — the key, the question mark and the type — as
`v-else-if="showsFieldTypes"`. So the hover of the row **replaced** the marks
with the button, the name took the whole place of the row, and the pointer that
came for the type was over the name.

The proof that the paint order was innocent: the hit test of the browser at the
place of the type returns the type itself (`document.elementFromPoint` →
`SPAN.ddb-table__field-type`), while the pointerdown of the same place arrives
at the name. The type was not covered, it was not in the document any more.

The button that removes the field now sits **next to** the marks instead of
taking their place, and the marks keep their own place in the row
(`flex: 0 1 auto`). The browser confirms it:

```
the type input: 1   the name input: 0
while the row is hovered: the name { x: 408, right: 483 }   the type { x: 497, right: 570 }   the remove { x: 574, right: 590 }
```

The test "the type of a field stays reachable while the row is hovered" was
written for this cause and fails without the fix.

## The fourth cause: the edit of a field was a text box

The inputs of the canvas were `NInput size="tiny"`, which draws the box of the
input library: a border, a shadow, a different type. The row of a field is
plain text, and the edit has to look like the row it replaces.

The canvas now draws its own edit: the border and the shadow of the library are
transparent, the type is inherited from the row, and the field that is edited
gets a soft blue background (`rgb(59 130 246 / 12%)`, 20% while the focus is on
it) with a radius of 4 pixels and a transition of 120 milliseconds.

## The fifth cause: a note was a picture

`Canvas/Note.vue` was 48 lines of static text: no pointer, no editable element,
no handle. A note could not be moved, could not be resized and could not be
written in. The note is now a real element of the canvas:

- the body of the note starts the drag that moves it, the way the area does;
- the corner of the note has a handle that resizes it, the way the table does;
- the title is written in place (a double click opens the input) and the content
  is written in the note itself; the text is written into the diagram when the
  field loses the focus, so that the history holds one entry for the whole text
  and not one for every letter;
- the lock of the note works like the lock of a table: a locked note cannot be
  moved, cannot be resized and cannot be written in.

The chain of the drag of a note had to grow with it: `MoveRequest` learned the
kind "note", the element actions learned `updateNote` and
`previewNotePositions`, the resize learned the kind "note" (a note is at least
120 by 80 pixels), and the canvas hands the drag of the note to the same path as
the drag of a table and of an area.

The browser confirms all of it:

```
the drag of the note:   translate(100 100) -> translate(200 170)
the resize of the note: 220x120 -> 280x160
the content of the note: A note that remembers.
the note is locked:     { locked: true, editable: false }
```

## The tests

Two new files, written before the fix, that failed before it:

- `packages/sdk/src/components/Canvas/table-locking.test.ts` — 13 tests: a locked
  table cannot be renamed, cannot be renamed through the sidebar either, cannot
  rename its fields, cannot change the type of its fields, cannot remove its
  fields, cannot be dragged, cannot be resized, does not let the user draw a
  relationship from it, its fields cannot be reordered; the type of a field
  stays reachable while the row is hovered; the type of a field is edited in
  place; the input of the type does not fill the row of the field; the input of
  the name has a class of its own.

The test of the third cause was checked against the code without the fix: it
fails there (`pass 12, fail 1`) and passes with it (`pass 13, fail 0`).
- `packages/sdk/src/components/Canvas/note-editing.test.ts` — 7 tests: the note
  is drawn with its content, it can be dragged, the drag of a note can be
  undone, it can be resized with its handle, the content of a note can be
  written, the title of a note can be written, a locked note cannot be edited.

## What else had to change

- `packages/sdk/src/stores/diagram.ts` grew past the 300 lines of the rules of
  the repository, so the helper of the sidebar moved into
  `packages/sdk/src/stores/side-panel-actions.ts` and the store is 293 lines
  again.
- `packages/core/src/commands/collection-commands.ts` learned
  `DiagramEntityInput`, so that a note can be added with the fields it carries
  without asking every model for an index signature.
- `scripts/naive-ui-mock.mjs` gives the class of the caller to the input of the
  library, so that a test can look at the class of the component it drives.

## The verification

| What | Result |
| --- | --- |
| `node --experimental-strip-types scripts/run-tests.mjs` | 727 tests, 727 pass, 0 fail (67 suites) |
| `pnpm typecheck` | clean |
| `pnpm e2e` | 51 passed, 0 failed |
| `pnpm build` | 4 tasks, 4 successful |
| the browser (Playwright against the app on port 4174) | the 5 behaviours above, 0 page errors |

The screenshot of the canvas after the fix lies in `docs/ui-ux-shots/` next to
the report of the design system.
