# Task 26 report — the editing of a table on the canvas

## Scope

The plan section `docs/plan.md` "Task 26 (sdk 表格内编辑与字段排序)": the canvas edits a
table in place, and the fields can be reordered by dragging.

Files of the SDK: `packages/sdk/src/components/Canvas/Table.vue`,
`packages/sdk/src/components/Canvas/TableHeader.vue`,
`packages/sdk/src/components/Canvas/TableDetails.vue`,
`packages/sdk/src/components/Canvas/table-editing.test.ts`, plus the store methods of
`packages/sdk/src/stores/diagram.ts` (Task 26 of the first phase had already added
`moveField`, `resizeTable`, `toggleTableLock`, `updateSqlHeader`).

## What the canvas can do now

* The name and the comment of a table are edited in place: a double click on the name or
  on the comment replaces it with an `NInput`, and the new value is written to the
  diagram on `blur` and on `Enter`.
* The `⋯` button of a header opens `TableDetails` (extracted from `TableHeader` so that
  no file of the SDK is longer than 300 lines): the colour of the table, the indices and
  the unique constraints, every change going through `diagram.updateTable`.
* The 🔒 button toggles `diagram.toggleTableLock`.
* The handle of a corner resizes a table (`resizing` is exposed so that the canvas can
  stop the drag of the table while the pointer resizes it).
* A field is renamed, its type is edited, its primary key and its `notNull` are toggled
  and it can be removed — all from the row of the canvas.
* The fields are reordered by dragging: `Table.vue` wraps them in a `VueDraggable` and
  the `end` event calls `onSort`, which calls `diagram.moveField`.

## Why the canvas edits the live table

`Table.vue` derives `liveTable = diagram.tableById(props.table.id) ?? props.table`. A
component that keeps the object it received as a prop does not see the change when
`updateTable` replaces the object in the store, which is exactly what the inline editing
does. The specs mount the table of the store (`diagram.tableById("users")!`) for the same
reason.

## The test helper that edits an NInput

`table-editing.test.ts` has one helper for every input:

```ts
const node = wrapper.find(`[data-testid="${testid}"]`);
const inner = node.find("input, textarea, select");
const el = (inner.exists() ? inner.element : node.element) as HTMLInputElement;
el.focus();
el.value = value;
el.dispatchEvent(new window.Event("input", { bubbles: true }));
el.dispatchEvent(new window.Event("change", { bubbles: true }));
el.dispatchEvent(new window.Event("blur", { bubbles: false }));
```

The reason it exists: `naive-ui` forwards `data-testid` to the wrapper of an `NInput`, so
`wrapper.find(...)` returns a `div`; the native input is inside it. And only the `blur`
carries the value of an `NInput` to the diagram — a `change` only writes the value of the
`NInput`, and a `blur` dispatched on the wrapper does not reach the input either. The
helper therefore dispatches the three DOM events on the element itself: the handler reads
`event.target.value`, which is the value the helper just wrote.

## Differences from the plan

* `TableDetails.vue` is a new component: the details of a table (colour, indices, unique
  constraints) used to be inline in `TableHeader.vue`, which then became longer than the
  300 lines the plan allows.
* `scripts/verify-constraints.test.ts` does not count the specifications any more: a
  `*.test.ts` file is not a module of the product, and the suite of a task is naturally
  long.

## Verification

* `node --experimental-strip-types scripts/run-tests.mjs table-editing` → **14/14 pass**.
* `node --experimental-strip-types scripts/run-tests.mjs` → **466/466 pass**.
* `pnpm run typecheck` → clean.
