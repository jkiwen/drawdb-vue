# UI/UX optimization report — canvas top and left operation areas

**Scope:** the top operation area (header, menu bar, toolbar) and the left
operation area (side panel and its tabs) of the Vue editor, plus the shell of
`drawdb-vue-app`.

**Method:** two rounds, each one driven by a `ui-ux-pro-max` review
(`design_review` + `design_search`) followed by an implementation and a
verification pass in a real browser (headless Chrome over CDP).

**Rule from `AGENTS.md`:** all work happened inside `sdk-workspace/`. The
legacy React app in `drawdb-app/` was not touched — the earlier work there was
rolled back completely (`npm run build` and `npm run lint` green, zero
`ddb-`/`editor-*` tokens left in `src`).

---

## 1. What was delivered before the optimization

| Area | Problem |
|---|---|
| Menu bar | The four groups rendered as one run of words (`FileEditViewHelp`), 2px apart, with no hover affordance. |
| Header | The title input and the database select were jammed against the menu; the two rows had no visual hierarchy. |
| Toolbar | Seven buttons in a single undifferentiated row — no grouping, no separators, and the `+`/`−` pair had no label. |
| Side panel | Ten tabs wrapped flat over three lines, with no grouping, no section title and no tinted strip; the tab strip was transparent against the body. |
| Side panel body | Spacing was hard-coded per component (2px/4px/8px), rows had no hover state, and the empty states used hard-coded `rgba(0,0,0,.45)`. |
| Type scale | No shared scale at all — every component picked its own font size. |
| Focus | No `:focus-visible` rule anywhere in the SDK or the app. |
| Motion | No transitions, so hover/active states were instantaneous and abrupt. |
| App shell | Three identical solid-accent buttons (no primary/secondary hierarchy); the browser's native file input was visible on screen because `.visually-hidden` was referenced but never defined. |

---

## 2. Round 1 — one design system for both operation areas

### 2.1 The token layer

New file `packages/sdk/src/styles/tokens.css` (imported once by
`DrawDBEditor.vue`). It declares the whole visual language of the editor and
maps every colour onto a Naive UI variable, so the editor keeps following the
host theme and the dark theme for free:

* spacing `--ddb-space-1..4` (4 / 8 / 12 / 16px) — one rhythm everywhere;
* radii `--ddb-radius-sm/md/lg` (4 / 6 / 8px);
* type scale `--ddb-text-title/body/meta/micro` (13 / 13 / 12 / 11px) and one
  `--ddb-font-family`;
* surfaces `--ddb-surface`, `--ddb-surface-muted`, `--ddb-surface-hover`,
  `--ddb-border`, `--ddb-border-strong`, `--ddb-text`, `--ddb-text-muted`,
  `--ddb-accent`;
* motion `--ddb-duration-fast` 120ms, `--ddb-duration-base` 180ms,
  `--ddb-easing cubic-bezier(0.4,0,0.2,1)`;
* `--ddb-hit-target: 24px` (the WCAG 2.2 web minimum) and a small z-index
  scale (`--ddb-z-header/panel`, `--ddb-z-dropdown`).

It also sets one font family on the Naive controls, a 2px
`:focus-visible` outline on every control of the editor, and a
`prefers-reduced-motion` block that collapses every transition to 1ms.

### 2.2 Top operation area

* `Header.vue` — row 1 is now the menu bar plus a right-aligned identity
  block (title + database); row 2 is the toolbar plus the state cluster. The
  save state is a tag with a **dot**, so the state is no longer carried by
  colour alone, and the save button is the one primary action of the row.
  The header itself is a surface with a bottom border and a layer.
* `MenuBar.vue` — the groups are 8px apart (the touch-spacing rule), 24px
  high, rounded, with a 120ms hover surface.
* `Toolbar.vue` — the buttons are split into three labelled groups —
  *create* (Table / Note / Area), *viewport* (ZOOM +/−), *show* (Grid /
  Panel) — separated by hairline dividers, and the zoom pair now carries the
  group label "ZOOM" instead of relying on the symbols alone.
* `UndoRedoButtons.vue` — token font, weight, radius and transition.

### 2.3 Left operation area

* `SidePanel.vue` — the tab strip became a tinted, bordered band; the body
  uses the 12px padding rhythm.
* `TablesTab.vue` — rows, the editor block and the field rows were restyled
  to the token scale, with hover states. Its stylesheet was moved to
  `SidePanel/tables-tab.css` to keep the component under the 300-line rule of
  the repository.
* `RelationshipsTab.vue`, `NotesTab.vue`, `AreasTab.vue` — one shared row
  treatment: 8px gaps inside a row, 4px between rows, rounded hover surface.
* `EnumsTab.vue`, `TypesTab.vue`, `CustomTypesTab.vue` — full-width add
  buttons with the token spacing.
* `ViewsTab.vue`, `SqlHeaderTab.vue`, `IssuesTab.vue` — muted/meta text for
  the secondary copy, a grouped issues list with an uppercase group title.

### 2.4 The app shell

`packages/app/src/styles.css` was rewritten to mirror the SDK: the same
spacing/radius/type/motion tokens, a global `:focus-visible` rule, a 14px
body type scale, pill navigation with hover and active surfaces, buttons with
a 24px minimum height and an `:active` press feedback, list rows with a
border-and-shadow hover, and a `prefers-reduced-motion` block.
`EditorView.vue` gained a labelled toolbar band.

---

## 3. Round 2 — hierarchy, states and semantics

Round 2 was reviewed with the same skill; the hits that mattered were *Active
State*, *Focus States*, *Compact Control Semantics*, *Icon Button Labels* and
*Touch Target Size*.

* **Side panel information architecture.** The ten flat tabs became three
  ordered groups — **DIAGRAM** (Tables, Relations, Notes, Areas),
  **DATABASE** (Enums, Views, Types, Custom Types, SQL Header) and **REPORT**
  (Issues). The order is the order of use. The open tab is a filled pill with
  an extra weight and keeps `aria-current="page"`.
* **A section title.** A `Tables` / `Notes` / `Issues` heading now sits
  between the tab strip and the content, so the body says what it is about
  (`data-testid="side-panel-title"`).
* **The visible file input.** `.visually-hidden` was referenced by
  `HomeView.vue` but never defined — the native picker ("选择文件 未选择任何文件")
  was on screen. The rule now exists and the input is hidden but still
  functional.
* **Button hierarchy in the app.** "New diagram" is the primary solid button;
  "Templates" and "Import JSON" are ghost buttons, so the accent is not used
  three times for three different actions.
* **Accessible names.** The icon-like controls of the toolbar carry
  `aria-label` ("Add table", "Add note", "Add area", "Zoom in", "Zoom out") and
  the Grid/Panel toggles expose `aria-pressed`, so the state is announced and
  not only painted.

---

## 4. Visual comparison

Captured from the same harness with the same headless-Chrome script; the
"before" is the git HEAD of `sdk-workspace`, the "after" is the working tree.
The images are kept next to this report in `docs/ui-ux-shots/`.

| | SDK test page | drawdb-vue-app test page |
|---|---|---|
| Before | `ui-ux-shots/before-sdk-page.png` | `ui-ux-shots/before-app-page.png` |
| After | `ui-ux-shots/after-sdk-page.png` | `ui-ux-shots/after-app-page.png` |

What the pair shows:

| | Before | After |
|---|---|---|
| Menu | `FileEditViewHelp` | `File  Edit  View  Help`, 8px apart, pill hover |
| Header row 1 | title + select jammed under the menu | identity block right-aligned on one row |
| Toolbar | 7 buttons in one flat row | 3 labelled groups with hairline dividers, `ZOOM` label |
| Side panel strip | 10 tabs wrapped flat over 3 lines | DIAGRAM / DATABASE / REPORT groups on a tinted band |
| Active tab | plain text | filled pill, heavier weight, `aria-current` |
| Panel body | search field directly under the tabs | "Tables" section title, then the search field |
| Save state | plain tag | tag with a dot (state is not colour-only) |
| App actions | 3 identical solid buttons | 1 primary + 2 ghost, native file input hidden |

---

## 5. Interaction regression

Verified in the live application (headless Chrome over CDP, page errors: 0):

| Behaviour | Result |
|---|---|
| Menu bar | File / Edit / View / Help present; the File dropdown opens (1 `.n-dropdown-menu`) |
| Header | 2 rows, title input, database select, save-state tag "Unsaved changes" |
| Toolbar | Table, Note, Area, +, −, Grid, Panel — all 7 intact |
| Side panel groups | Diagram, Database, Report |
| Side panel tabs | all 10 present, section title "Tables", search box present |
| Tab switching | notes → "Notes" + notes panel; issues → "Issues" + issues panel |
| Add table | the list grows 2 → 3 |
| Undo | the list goes back 3 → 2 |
| Grid toggle | `aria-pressed` true → false, Naive class flips primary → default |
| Sidebar toggle | the panel hides and comes back |
| Zoom in / out | responds, no error |
| Harness "Add table" button | readout and the TEST CORE AREA fact update (2 → 4) |

Build gates: `pnpm typecheck` clean · `pnpm test` **603 passed / 0 failed**
(46 suites) · `pnpm build` **4/4 tasks** (core, sdk, app, example).

> Build note: the app bundle needs `$env:TEMP`/`$env:TMP` on a workspace-local
> folder and `NODE_OPTIONS=--max-old-space-size=8192`, otherwise the Vite/esbuild
> temp file hits an access-denied and the process then dies with a heap OOM.
> This is an environment issue, not a defect of the change.

---

## 6. Repositories fixed on the way

These were needed to make the workspace verifiable and are not cosmetic:

* `scripts/build-sdk.mjs` — `copy()` did not create the target directory, so
  the new `dist/styles/tokens.css` failed with `ENOENT`.
* `turbo.json` — the key was `"pipeline"`, which turbo 2.11.10 rejects
  ("Found `pipeline` field instead of `tasks`"); renamed to `"tasks"`.
* `scripts/verify-workspace.test.ts` — asserted the old `turbo.pipeline` key.
* `scripts/verify-release.test.ts` — asserted the editor in `App.vue`; the
  editor now lives in `AppHarness.vue`, so the test reads both files.
* `examples/vue-embed/src/AppHost.vue` — `router.destroy()` is not part of
  the `Router` type; removed.
