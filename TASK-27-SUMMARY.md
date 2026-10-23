# Task 27 Summary: Side-Panel Editors, SFC Loader and Test Suite

## Status: ✅ complete — the whole suite is green

`node --experimental-strip-types scripts/run-tests.mjs` → **487 tests, 487 pass, 0 fail**, including the
`verify-constraints` spec (the 300-line limit for every SDK source file).

## 1. Side-panel editors (new components)

Views, custom types, enums and the SQL header became first-class editors of the side panel:

| Component | Responsibility | Test ids |
| --- | --- | --- |
| `ViewEditor.vue` | name, base table, joins, columns and conditions of a view | `view-editor-<id>`, `view-name-<id>`, `view-base-table-<id>`, `view-join-table-<view>-<pos>`, `view-column-alias-<view>-<pos>`, `view-condition-value-<view>-<pos>`, `remove-…`, `add-…` |
| `TypeEditor.vue` | name, comment and fields of a custom type | `type-editor-<key>`, `type-name-<key>`, `type-comment-<key>`, `add-field-<key>` |
| `TypeFieldEditor.vue` | one field of a custom type | `type-field-<id>`, `type-field-name/type/values-<id>`, `remove-type-field-<id>` |
| `EnumEditor.vue` | the values of an enum | `enum-editor-<name>`, `enum-name-<name>`, `enum-value-<name>-<pos>`, `remove-enum-value-<name>-<pos>`, `add-enum-value-<name>` |
| `CustomTypesTab.vue`, `SqlHeaderTab.vue` | the tabs of the side panel | `add-custom-type-btn`, `sql-header-input` |

Every editor emits its change and never mutates the store, so the undo/redo of the diagram applies to
side-panel edits as well. `packages/sdk/src/stores/diagram.ts` gained the matching actions
(`addView/updateView/removeView`, `addType/…`, `addEnum/…`) through one module-level factory, which is
also what keeps the store under the 300-line limit (279 lines).

## 2. The SFC loader of the test runner (`scripts/sfc-loader.mjs`)

The runner imports every specification into one process (the sandbox blocks vitest and child processes),
so `.vue` files are compiled on the fly with `@vue/compiler-sfc` 3.5.0 while the Vue runtime is 3.5.44.

Three fixes were needed:

1. **The `__isScriptSetup` flag had to be removed from the compiled script.** In
   `runtime-core.cjs.js:3499` `hasSetupBinding` is `state !== EMPTY_OBJ && !state.__isScriptSetup &&
   hasOwn(state, key)`, and `exposeSetupStateOnRenderContext` copies the bindings onto `ctx` only when
   the flag is absent — a runtime-only load never prefills `accessCache`, so a flagged binding object
   is unreachable for the render function. The loader now strips
   `Object.defineProperty(__returned__, '__isScriptSetup', …)` from the body.
2. **Imported child components are registered on the exported component** (`__VUE_COMPONENT__.components = { … }`),
   because the render of a template that uses `<ViewEditor />` resolves the name from the instance type.
   The import matcher accepts named imports too (`import { DrawDBEditor } from "…"`).
3. **The render body is transpiled** with `typescript.transpileModule`, because a `<script setup lang="ts">`
   puts TypeScript expressions (`($event.target as HTMLInputElement).value`) into the template verbatim.

The loader supports both shapes of single-file component: `<script setup>` with a real `<template>` block,
and a plain script whose markup lives in a `template` option.

## 3. The mock of Naive UI (`scripts/naive-ui-mock.mjs`)

The SDK renders Naive UI components, which are not usable under jsdom, so the runner installs a mock
plugin. Every mock renders a real element and spreads the inherited attributes onto it (that is what
carries `data-testid`), and the handlers are not called twice (the template's `@click` arrives through
`attrs.onClick`). `NInput` renders an `<input>`/`<textarea>`, `NSelect` renders a `<select>` with its
options, `NCheckbox` renders a checkbox, and `VueDraggable` renders a container.

## 4. Specifications

- `packages/sdk/src/components/SidePanel/side-panel-editors.test.ts` — 21 tests for the four editors.
- `packages/sdk/src/components/SidePanel/SidePanel.test.ts`, `packages/sdk/src/components/Header/Header.test.ts`,
  `packages/sdk/src/components/Canvas/table-editing.test.ts` — the naive plugin added to every mount, the
  selectors aligned with what the components really render (the testid is on the element itself, not on a
  wrapper) and the `enum-editor-`/`view-editor-`/`type-editor-` ids corrected.
- `packages/app/src/App.test.ts`, `packages/app/src/integration.test.ts` — `DrawDBEditor` registered by
  name for the view of the application, the canvas really asserted to hold a table.
- `packages/sdk/src/components/DrawDBEditor.vue` gained `defineOptions({ name: "DrawDBEditor" })`.

## Files

- New: `ViewEditor.vue`, `TypeEditor.vue`, `TypeFieldEditor.vue`, `EnumEditor.vue`, `CustomTypesTab.vue`,
  `SqlHeaderTab.vue`, `side-panel-editors.test.ts`, `scripts/naive-ui-mock.mjs`.
- Modified: `scripts/sfc-loader.mjs`, `SidePanel.vue`, `ViewsTab.vue`, `TypesTab.vue`, `EnumsTab.vue`,
  `SidePanel/index.ts`, `stores/diagram.ts`, `stores/ui.ts`, `EditorLayout.vue`, `DrawDBEditor.vue`,
  `Canvas.vue` (the TypeScript non-null assertions removed from the template) and the four specifications.

## How to run

```bash
cd sdk-workspace
node --experimental-strip-types scripts/run-tests.mjs            # the whole suite
node --experimental-strip-types scripts/run-tests.mjs SidePanel  # one specification
```

The runner scans `packages/*/src` for `*.test.ts`, registers the TypeScript resolver and the SFC loader
hooks and installs the DOM itself — a specification must not install it.
