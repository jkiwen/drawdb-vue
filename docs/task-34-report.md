# Task 34 report: the areas of the canvas — the fold, the lock, the details and the five defects

The work that the commit of the details of a table left out. The tree held the
areas of the canvas in a state that could be neither folded nor locked, the
lock of a note that could not be unlocked, and the five defects the user found
in that behaviour. The ledger of the workspace says that the other tasks of a
commit stay out of it, so those changes waited for a commit of their own. This
is that commit.

## What this task did

| Step | Result |
| --- | --- |
| The area carries its state | `packages/core/src/models/area.ts` — the optional `collapsed` flag and the optional `locked` flag next to the `color`, so a folded or a locked area survives the round trip of the diagram JSON and the storage of the browser |
| One membership rule for the three behaviours | `packages/sdk/src/utils/elements.ts` — `areaHolds` is the **overlap of the two rectangles** and not the corner of the element any more; `heldByCollapsedArea` and `heldByLockedArea` use it, and so does the drag |
| The fold of an area hides what it holds | `packages/sdk/src/composables/use-canvas-items.ts` — the tables, the notes and the views that lie in a folded area are not drawn, and the relationships that reach out of it are counted on a badge (`AreaLinkBadge.vue`) |
| The lock of an area extends to what it holds | `packages/sdk/src/stores/diagram.ts` and `stores/element-actions.ts` — a table that a locked area holds is a locked table; the only write that still goes through is the one that only touches the lock |
| The details of an area | `packages/sdk/src/components/Canvas/AreaDetails.vue` — a panel in the canvas for the name, the description, the colour and the opacity, drawn outside of the group of the area so that it neither moves the area nor reaches the canvas |
| A locked note can be unlocked | `packages/sdk/src/components/Canvas/Note.vue` — the button of the lock is drawn whatever the state of the note is; the condition belonged to the content of the note, not to the button |
| The panel of the sidebar says that a table is locked | `packages/sdk/src/components/SidePanel/TablesTab.vue` — the inputs are disabled, the buttons that change the table are gone and a tag says that the table is locked |

## The scope of the feature

| Piece | Where |
| --- | --- |
| The rule that says what an area holds | `areaHolds(area, element)` in `packages/sdk/src/utils/elements.ts` — the overlap of the two rectangles; an element without a size is a point, and the rule of a point is the rule of the corner |
| The areas that fold and the areas that lock | `collapsed` and `locked` in `packages/core/src/models/area.ts`; both are optional and both survive the JSON round trip |
| What a fold hides | the tables, the notes and the views of the area, and the relationships that touch them |
| What a lock freezes | the area itself and every element it holds, in the canvas and in the sidebar |
| The badge of a folded area | `AreaLinkBadge.vue` — the count of the relationships that reach out of the area, and a dashed line to each of them on the hover |

The split is the point of the task: the fold, the lock and the drag answer the
same question of the membership with the same rule, so a table that lies in an
area is folded with it, locked with it and taken along by it — and a table that
hangs over the edge of an area but starts outside of it stays out of all three.

## The differences with the specification

- **The rule of the membership is the overlap and not the corner** — the rule
  of the corner left a table that was drawn inside an area and hung over its
  edge in a state that no user could describe: it was drawn in the area, it
  was not folded with it and it was not taken along by it either. The rule of
  the overlap answers the question the user asks — an element that lies in an
  area belongs to it. It still needs no field in the model, so the diagram
  keeps its arrangement through a round trip of the JSON.
- **The relationships of a folded area are counted and not lost** — a
  relationship that connects a table inside a folded area to a table outside of
  it is hidden with the area. Without a badge the user would have to expand the
  area to find out that the relationship was still there, so the title bar
  carries the count and the hover draws the line to each of the tables outside.
- **The panel of the details hangs below the area** — a panel inside the group
  of the area would move with it, and the button that closes it would never
  see the click, because the area would move away under the pointer. The panel
  is drawn outside of the group, the way `Note.vue` draws its own text.
- **The commit carries the feature and the defects together** — the fold, the
  lock, the panel of an area, the lock of a note and the five defects of the
  user touch the same files of the same area, and none of them works without
  the others. They are one commit, and the report of the area names them one
  by one.

## The five defects of the user, and where they are answered

| The report of the user | The answer |
| --- | --- |
| "area 折叠后，area 中的内容 table,note 没有被折叠，任然为可见状态" | The rule of the overlap, and the filter of the fold in `use-canvas-items.ts` |
| The relationships of a folded area are lost | The badge of the title bar and the dashed line of the hover |
| The lock of a table is only a picture | The store refuses every change of a locked table, and the panel of the sidebar says so |
| The type of a field cannot be edited | The marks of the field keep their own place in the row, so the hover does not take the type away |
| A note cannot be moved, resized or written in | `Note.vue` is an element of the canvas and not a picture |

## The verification

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | clean (core, SDK, application, example, e2e) |
| `node --experimental-strip-types scripts/run-tests.mjs` | 727 tests, 727 pass, 0 fail (67 suites) |
| `pnpm run e2e` | 51 of 51 |
| `pnpm run build` | 4 of 4 tasks (core, SDK, application, example) |
| the browser | a probe in a real browser: 12 tables, 5 of them hidden by the fold, the badge of the relationships that reach out, and the 12 back at their places when the area expands; 0 page errors |

The new specifications of this task: `packages/sdk/src/components/Canvas/area-defects.test.ts`
(the five defects), `packages/sdk/src/utils/elements.test.ts` (the rule of the
membership and the helpers of the areas), `packages/core/src/models/area.test.ts`
(the model of the area) and `packages/sdk/src/components/SidePanel/AreasTab.test.ts`
(the panel of the areas of the sidebar).
