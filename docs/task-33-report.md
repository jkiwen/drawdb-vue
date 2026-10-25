# Task 33 report: the menu of the editor, the dialogs it opens and the end to end tests that drive it

The work that the commit of the design system left out. The tree held the
menu, the dialogs, the bridge of the editor and the end to end tests of the
application; the ledger of the workspace says that the other tasks of a
commit stay out of it, so those changes waited for a commit of their own.
This is that commit.

## What this task did

| Step | Result |
| --- | --- |
| The menu of the editor answers on its own | `packages/sdk/src/composables/editor-menu.ts` — `runEditorMenu(key, actions)` returns whether the editor handled the key, and `isHostOwnedMenuKey(key)` names the keys the host application owns |
| The dialogs live in the SDK | `packages/sdk/src/stores/dialogs.ts` — a store of the open dialogs and of their format, so the component that renders them and the commands that open them share one state |
| The commands of the editor speak the menu | `packages/sdk/src/composables/use-editor-commands.ts` — `onMenu(key)` returns `true` when the editor answered, and the commands gained `deleteSelection()` and `exportJson()` |
| The dialogs carry their content | `Dialogs/{SqlPreviewDialog,ImportDialog,ImageExportDialog}.vue` — the preview names its format, the import names the format and the database, the export reads the live canvas for its preview |
| The application reaches the editor | `packages/app/src/services/editor-bridge.ts` — the bridge publishes `window.__DRAWDB__` so a test in the browser can drive the editor |
| The end to end tests of the application | `e2e/{commands,data,editor,i18n,storage}.spec.ts` and `e2e/helpers.ts` — the commands, the SQL of three databases, the editing of a table, the language of the editor and the persistence in the browser |
| The mock of the UI library is complete | `scripts/naive-ui-mock.mjs` — the container `NConfigProvider` and the `NGlobalStyle` joined the registry, and every specification that mounts a component of the SDK installs the mock |

## The scope of the feature

| Piece | Where |
| --- | --- |
| The keys of the menu that the editor answers | `file:save`, `file:export-sql`, `file:export-dbml`, `file:export-json`, `file:import-json`, `file:import-sql`, `file:export-png`, `file:auto-relationships`, `file:toggle-fullscreen`, `edit:add-table`, `edit:add-note`, `edit:add-area`, `edit:auto-layout`, `edit:delete`, `view:zoom-in`, `view:zoom-out`, `view:reset-view`, `view:toggle-grid`, `view:toggle-sidebar`, `view:toggle-view-mode`, `view:validate` |
| The keys the host application owns | `file:new`, `file:open`, `edit:add-relationship`, `help:documentation`, `help:about` |
| The dialogs of the SDK | `sqlPreview`, `import`, `imageExport`, `autoRelationships` |

The split is the point of the task: the editor answers what it owns and says
so, and the host application keeps the file browser, the documentation and the
relationship editor. The application of the workspace answers the five keys
that belong to it and lets the editor answer the rest.

## The differences with the specification

- **The dialogs moved into the SDK** — the plan of the phase 2 had the host
  application render the dialogs and own their open state. The editor renders
  them itself now, because the menu of the editor opens them and the host
  cannot know which one a menu entry asks for. The host still receives the
  result: `onExportJson(json)` carries the JSON of the diagram, and
  `onOpenDialog(dialog, options)` still exists for a host that wants to open
  a dialog of its own.
- **The menu answers with a boolean** — `onMenu(key)` returns `true` when the
  editor handled the entry and `false` when the host has to handle it. The
  application reads the boolean and only opens its own dialogs when it is
  `false`; before, the same switch lived in the view of the application and
  the editor could not open a dialog of its own.
- **The bridge is on the window** — `window.__DRAWDB__` is a plain object of
  functions. It exists for the end to end tests, which run in the browser and
  cannot reach into the component tree; the application installs it and
  removes it when the editor is unmounted.
- **The state of a diagram cannot be a proxy** — the structured clone of
  IndexedDB refuses a reactive proxy, so `IndexedDBStorageAdapter.save()`
  writes `cloneDiagram(diagram)` and the store of the save keeps
  `deepClone(diagram)`. Without the copy, saving a diagram that the editor
  had touched failed with a `DataCloneError`.
- **The template ref of the file picker is a ref** — `HomeView.vue` held the
  input in a plain variable, and Vue warned that a template ref on a
  non-ref value does not work in a production build. The variable is a `ref`
  now and the warning is gone.
- **The specifications that mount the SDK install the mock of the library** —
  `scripts/naive-ui-mock.mjs` mocks Naive UI, because it is a browser only
  dependency and the specifications mount the components in a jsdom document.
  The mock was missing the container `NConfigProvider` and the `NGlobalStyle`,
  so every specification that mounted the editor reported hundreds of
  unresolved components. The warnings are zero now.

## The verification

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | clean (core, SDK, application, example, e2e) |
| `node --experimental-strip-types scripts/run-tests.mjs` | 603 tests, 603 pass, 0 fail, and no warning of Vue about an unresolved component |
| `pnpm run build` | 4 of 4 tasks (core, SDK, application, example) |
| the end to end tests | 45 pass (`--grep-invert "the area of the canvas"`) |

The two failures of the area specification are older than this task:
`e2e/areas.spec.ts` is unchanged, and on the commit of the areas the same
specification failed six times instead of two. The failures are the two
pixels of the pointer of a drag of an area that grew while the pointer was
pressed; they belong to the interaction of the areas and not to the menu.
