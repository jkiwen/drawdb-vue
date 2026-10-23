# Task 13 Report: Build Side Panel Components

## Scope

Creates the side panel of the editor in `packages/sdk/src/components/SidePanel/`:

| File | Responsibility |
| --- | --- |
| `SidePanel.vue` | The tab bar and the body that shows the active tab. The active tab lives in the UI store. |
| `TablesTab.vue` | Lists the tables, filters them and edits the selected table and its fields. |
| `RelationshipsTab.vue` | Lists the relationships and removes them. |
| `NotesTab.vue` | Lists the notes and removes them. |
| `AreasTab.vue` | Lists the areas and removes them. |
| `EnumsTab.vue` | Lists the enums and removes them. |
| `ViewsTab.vue` | Lists the views and removes them. |
| `TypesTab.vue` | Lists the custom types and removes them. |
| `index.ts` | Barrel of the panel and of the tabs. |

Every change of the panel goes through the diagram store, which records it in the
history store. A rename, a new field, a removed field, a removed table, a removed
relationship and a removed note are therefore all undoable.

## Dependencies

- Naive UI for the buttons, the input, the checkbox, the tag and the empty state.
- The stores of Task 9 (`useDiagramStore`, `useUIStore`, `useHistoryStore`).
- `createId` of `@drawdb/core` for the identifiers of the new fields.

## Differences from the plan

- The plan names the seven tab components and the barrel; the implementation adds no
  further file.
- The plan does not describe what the tabs do. The tables tab edits the selected table
  and its fields, because that is the part of the React side panel the user spends
  most of the time in. The other tabs list their elements and can remove them.
- The plan does not say when a change is committed. The name of a table and the name and
  the type of a field are edited in a local draft and committed when the input loses the
  focus, so that a rename is one undoable step and not one step per keystroke.
- The search field of the tables tab is bound to the search term of the UI store, so the
  canvas and the panel filter together.

## Environment work

- `NCheckbox` of Naive UI renders a `div` with `role="checkbox"` and **no** native
  `input` element. The spec therefore clicks the element itself.
- The tab bar is a list of `NButton`s and not an `NTabs`: `NTabPane` renders its content
  only after it has been activated, which would make the content of the other tabs
  disappear from the markup.

## Tests

`packages/sdk/src/components/SidePanel/SidePanel.test.ts` — 13 specs:

1. renders the tab bar
2. lists the tables of the diagram and selects one
3. shows the fields of the selected table
4. renames a table through the panel and records it in the history
5. adds a field to the selected table
6. removes a field from the selected table
7. toggles the primary flag of a field
8. deletes the selected table (and its relationships)
9. switches to the relationships tab and lists the relationships
10. deletes a relationship
11. lists the notes, the areas, the enums, the views and the types
12. deletes a note
13. filters the tables with the search term

Workspace suite: 266/266 specs pass. `pnpm run typecheck` is clean.
