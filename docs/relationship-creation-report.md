# The relationship between two tables

A relationship could not be created between two tables. The user drew a link
from the handle of a field to the other table and nothing happened; the entry
of the menu that adds a relationship did nothing either.

A second symptom appeared with the dialog: a relationship that existed in the
diagram was no longer drawn on the canvas at all. The relationship was in the
document, with the right coordinates, but it was drawn 652 pixels to the left
of the canvas and therefore out of sight.

This document records the causes, the fixes and the contract that the creation
and the drawing of a relationship follow now.

## The commits

| Commit | Content |
|---|---|
| _uncommitted_ | The link that ends on a table, the dialog of the relationship, the entry of the menu that opens it and the tests of both |
| _uncommitted_ | The class of the relationship of the canvas, so that the styles of the dialog do not reach it, and the link that ends on a table without a primary key |

## The fourth cause: the styles of the dialog reached the canvas

The relationship of the canvas and the dialog that creates a relationship both
carried the class `ddb-relationship`. The stylesheet of the dialog is global
— it is imported by the dialog and not scoped — and it places the dialog in
the middle of the screen:

```css
.ddb-relationship {
  left: 50%;
  position: fixed;
  transform: translateX(-50%);
}
```

The node of the canvas therefore inherited `left: 50%`. In SVG 2 `left` and
`top` are a translation even when the element is not positioned, so the whole
group of the relationship was moved by half the width of the canvas — 652
pixels in the example — and out of the visible area. The tables were not
moved, because they carry a class of their own, and the user saw a canvas
with tables and without relationships.

The class of the canvas is now `ddb-canvas-relationship`, next to the
`ddb-logical-relationship` of the logical view, and the dialog keeps
`ddb-relationship`. The regression test
`Canvas/relationship-collision.test.ts` mounts the dialog and the canvas
together and refuses a class that both of them carry.

## The three causes of the creation

The bug had three causes that hid each other. Any one of them alone was
enough to make the creation of a relationship fail, and none of them produced
an error: the canvas swallowed the pointer, the menu handed the key to the host
that had no handler for it, and the handle of a field was half cut off by the
table it belongs to.

### 1. The link had to end on a handle

`commitLink()` of `use-canvas-actions.ts` resolved the end of the link with a
single lookup:

```ts
const handle = target.closest("[data-field-handle]");
```

A handle is a small dot on the right edge of a row of a table. Releasing the
link on the body of the table, on the header of the table or on the name of a
field resolved to nothing, so `linking.finish(undefined)` cancelled the link
and no relationship was written. The only way to create a relationship was to
hit the dot itself, which is the smallest target of the canvas.

### 2. The handle was cut in half

The dot was drawn with `right: -5px` on the right edge of the table, and the
body of the table had `overflow: hidden`. The dot was therefore clipped by the
table that carried it: only its left half was visible, and the half that
remained sat under the pointer of the user at the moment the link was
released, so the release resolved to the row and not to the handle.

This is the second half of cause 1: even the target that was correct was
hard to hit.

### 3. The menu handed the key to a host that ignored it

`editor-menu.ts` listed `edit:add-relationship` among the `HOST_OWNED_KEYS`, so
`runEditorMenu()` returned `false` for it and the editor emitted the key to
the host application. The host of the SDK — `EditorView.vue` of
`packages/app` — handles `file:new`, `file:open` and the two entries of the
help, and nothing else, so the key fell into the `default` branch and the
entry of the menu did nothing at all.

The key was listed as host owned because the relationship editor was planned
as a dialog of the application, but no such dialog was ever written. The plan
of the SDK never asked for it, so the entry of the menu had been dead since
the menu was written.

## The fix

**The link ends on a table as well as on a field.** The resolution of the
target moved into its own file, `Canvas/interactions/link-target.ts`, and
`resolveLinkTarget()` walks the element under the pointer and its ancestors
from the closest one to the farthest one:

1. `[data-field-handle]` — the link ends on that field.
2. `[data-field-id]` — the link ends on that field (the row of a field).
3. `[data-table-id]` — the link ends on the table, and the canvas links it to
   the primary key of that table.

The order matters: the row of a field carries the id of its table as well, so
the field is looked up before the table. A link that ends on a table without
a primary key ends on the first field of that table, so that the link the
user drew never disappears without a word.

**The handle is inside the table and big enough to hit.** The body of the
table does not clip any more (`overflow: visible`), the rows are clipped by
their own block instead, so they keep the rounded corners of the table. The
handle grew from a dot of ten pixels that sat half outside of the table to a
target of fourteen pixels that sits inside the edge of the row, and the dot is
drawn by the `::before` of the handle. The pointer therefore always resolves
to the handle, and the handle resolves to the field it belongs to.

**The editor answers the key itself.** `edit:add-relationship` left the
`HOST_OWNED_KEYS`, `runEditorMenu()` answers it with `actions.addRelationship()`
and the command opens the dialog of the relationship through
`options.onOpenDialog?.("relationship")`. The dialogs store knows the new
dialog (`relationshipOpen`), `EditorDialogs.vue` renders it and
`EditorLayout.vue` binds it to the store.

**The dialog of the relationship.** `Dialogs/RelationshipDialog.vue` is the
second way to create a relationship, next to the link of the canvas. It picks
the two ends of the relationship (the table and, when the table has one, the
field), the cardinality and the referential actions, and writes the result
with `diagram.addRelationship()`, so that the creation can be undone like
every other change of the diagram.

The dialog refuses to create a relationship whose two ends are the same field,
and it refuses one whose end is a table without a field at all. A table
without a primary key is not refused: the first field of the table is the end
of the relationship, the same way the link of the canvas ends on it. The name
of the relationship defaults to the name of the foreign key
(`fk_<source>_<field>_<target>`) and the user can write another one.

## The contract

* A link that ends on a field links that field.
* A link that ends on a table links the primary key of that table.
* A link that ends on a table without a primary key links the first field of
  that table.
* A link that ends on the canvas adds no relationship.
* A link that ends on a table with itself and the same field adds no
  relationship.
* The entry of the menu that adds a relationship opens the dialog of the
  relationship, and the dialog writes the relationship into the diagram.
* Every relationship that is created, by the link or by the dialog, is undone
  with the history of the editor.
* A relationship is drawn on the canvas where its two ends are, and the styles
  of the dialog never reach the nodes of the canvas.

## The verification

| Check | Result |
|---|---|
| `pnpm typecheck` | The five projects compile without an error |
| `pnpm test` | 631 tests pass, 0 fail |
| `pnpm build` (turbo) | 4 tasks succeed: the core, the SDK, the application and the example |
| The browser | The relationship is drawn between the two tables of the example, and a link that the user drags from the handle of a field to the other table adds a relationship |

The new tests:

* `Canvas/relationship-collision.test.ts` — the relationship of the canvas and
  the dialog of the relationship do not carry a class of the same name, and
  the relationship of the canvas is not placed by the styles of the dialog.
* `Canvas/interactions/link-target.test.ts` — the resolution of the target of
  a link: a handle, a row, a table, the canvas, a child of a table and an
  element without a table.
* `Canvas/interactions/canvas-interactions.test.ts` — the link that ends on a
  table, the link that ends on a row, the link that ends on a table without a
  primary key and the undo of a relationship that a link created.
* `Canvas/interactions/interactions.test.ts` — the link that ends on a table
  without a primary key, at the level of the composable.
* `Dialogs/relationship-dialog.test.ts` — the creation of a relationship
  between two tables, the link to the primary key of a table alone, the name
  of the relationship, the refusal of a relationship with itself, the refusal
  of a relationship without a table and the undo.
* `Dialogs/dialogs.test.ts` — the entry of the menu that adds a relationship,
  from the key of the menu to the relationship of the diagram.
* `composables/editor-menu.test.ts` — the key of the menu is answered by the
  editor and no longer left to the host.
