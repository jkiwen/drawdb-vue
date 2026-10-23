# Task 32 report: documentation, version 0.2.0 and the pre-release verification

The last task of the phase 2 plan. It closes the second phase of the drawDB Vue
workspace: every capability of the React application is in the SDK now, the
version is 0.2.0 and the release candidate is verified by the specifications.

## What this task did

| Step | Result |
| --- | --- |
| The release specifications of 0.2.0 | `scripts/verify-release-020.test.ts` — the four manifests and the section 0.2.0 of the changelog |
| The bump | `version: 0.2.0` in the root, the core, the SDK and the application |
| The changelog | the section `## 0.2.0` above `## 0.1.0`, with the four packages |
| The readmes | the workspace (`The capabilities of 0.2.0`), the core (the validation, the layout and the inference, the JSON), the SDK (the three new methods, the store of the selection, the three new composables), the application (the service of the JSON and the toolbar) |
| The verification | see below |

The verification of the release:

```
pnpm run typecheck        # the five programs: core, sdk, app, the example and the e2e
pnpm run build:packages   # the distribution of the two packages
node --experimental-strip-types scripts/run-tests.mjs   # 533 tests, 0 fail
pnpm run pack:packages    # .release/drawdb-core-0.2.0.tgz, .release/drawdb-vue-sdk-0.2.0.tgz
```

`node --experimental-strip-types scripts/run-tests.mjs verify-release` → 9 tests, 9
pass (the seven specifications of 0.1.0, now pinned at 0.2.0, plus the two new ones).

## The scope of the phase 2 (tasks 21–32)

| Task | Commit | What landed |
| --- | --- | --- |
| 21 | `eac4bb3` | the validation of a diagram in the core, with the structured issues |
| 22 | `321b84b` | the automatic layout with dagre and the inference of the relationships |
| 23 | `a660877` | the JSON import and export of a diagram, with the class `ImportError` |
| 24 | `9fd4fca` | the commands completed, reorganised into five files by family |
| 25 | `dcc065b` | the canvas split into components and the interaction layer |
| 26 | `10bf68d` | the editing of a table and the reordering of the fields on the canvas |
| 27 | `8128dc1` | the editors of the side panel: the views, the types, the enums, the custom types, the SQL header |
| 28 | `067af13` | the dialogs: the SQL preview, the import, the automatic relationships and the wiring of the menu |
| 29 | `467dda3` | the fullscreen mode and the export of an image |
| 30 | `15d893b` | the panel of the issues of the side panel |
| 31 | `32ba516` | the application imports and exports a diagram as JSON, arranges and validates |
| 32 | this commit | the version 0.2.0, the changelog, the readmes and the verification |

The suite went from 334 tests (the end of the first phase) to 533, all green, and
the type check is clean for the five programs.

## The differences with the specification

- **`SetDiagramCommand` does not exist** (spec §4.4). The properties of a diagram
  (the title, the dialect, the SQL header) are written by the existing
  `UpdateDiagramCommand(diagram, updates: DiagramProperties)`, which the plan of
  Task 24 required as well. The command was not needed for any of the features of
  the phase 2.
- **The minimap is a part of the canvas of Task 25**, not of the image export of
  Task 29. It is the component `Canvas/Minimap.vue` with the test ids `minimap`
  and `minimap-table-<id>`, and the end to end test of Task 25 asserted it.
- **The selection was split out of the UI store in Task 30** (`useSelectionStore`),
  because the issues panel has to drive the canvas selection without an instance of
  the editor. The UI store keeps its own selection refs until a later task makes it
  read from the store of the selection.
- **The SFC loader of the test runner carries two patches** over the output of
  `compileScript` (Task 27): the flag `__isScriptSetup` is removed from the
  returned bindings, so that the runtime copies them onto the render context, and
  the imported child components are registered on the exported component, because a
  template that uses `<ViewEditor />` looks the name up in the type of the instance.
- **The UI library is mocked by `scripts/naive-ui-mock.mjs`**, a module of the test
  runner, because `naive-ui` is a browser only dependency and the specs mount the
  components of the SDK with `@vue/test-utils` in a jsdom document.

## The verification of the release candidate

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | clean (core, SDK, application, example, e2e) |
| `pnpm run build:packages` | OK — 41 components, 51 locales |
| the workspace specifications | 533 tests, 533 pass, 0 fail |
| the release specifications | 9 tests, 9 pass |
| `pnpm run pack:packages` | `.release/drawdb-core-0.2.0.tgz`, `.release/drawdb-vue-sdk-0.2.0.tgz` |

The two tarballs are the release candidate. They are not published to npm, which
is the strategy of the first version as well: the tag `v0.2.0` triggers the
workflow of the release, which packs the packages and uploads the tarballs as an
artifact of the workflow.
