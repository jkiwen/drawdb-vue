# Task 18 — End-to-End Testing & Performance Optimization

## Scope

The plan asks for three things in this task:

- a composable that virtualizes the elements of the canvas,
- the integration of that composable into the canvas,
- the end to end tests of the application (a smoke test and a performance test).

## Dependencies

- `packages/sdk/src/components/Canvas/Canvas.vue` and the geometry helpers
  (`tableBounds`, `logicalTableBounds`, `noteBounds`, `areaBounds`, `viewBounds`).
- The stores of the SDK (the diagram store and the UI store).
- `@playwright/test` (a new development dependency of the workspace).

## The virtualization

`packages/sdk/src/composables/use-virtualization.ts` holds `useVirtualization`, a
composable that keeps only the elements that lie inside of the viewport:

```ts
export function useVirtualization<T extends VirtualizableElement>(
  elements: Readonly<Ref<T[]>>,
  viewport: Readonly<Ref<VirtualViewport>>,
  options: VirtualizationOptions = {},
): VirtualizationApi<T>
```

The composable is generic, so the canvas can attach the object it draws to
every item and keep it after the culling (`interface CanvasItem<T> extends
VirtualizableElement { item: T }`).

The viewport is expressed in the coordinates of the canvas and grows by the
`overscan` (the margin that is drawn around the visible area, so that a table
does not disappear while the user scrolls).

The canvas derives the viewport from the visible area of the world
(`viewportRect`) and calls the composable four times: once for the tables, the
notes, the areas and the views. The relationships are not virtualized, because
a relationship is only drawn when one of its tables is visible.

## The integration in the canvas

`Canvas.vue` builds the items of the canvas (`tableItems`, `noteItems`,
`areaItems`, `viewItems`) and lets the composable do the culling. The old
`filterVisible` helper of `geometry.ts` is no longer used by the canvas; it
stays in the module, because it is part of the public geometry helpers.

The tables that are hidden (`table.hidden`) are filtered out before the
culling, exactly as before.

## The tests

- `packages/sdk/src/composables/use-virtualization.test.ts` — 6 specifications:
  the elements outside of the viewport are culled, the composable follows the
  viewport, the elements that end at the border stay visible, the overscan
  keeps a margin, an element without a size is treated as a point, and the
  composable follows the elements.
- `packages/app/src/integration.test.ts` — 4 specifications that walk through
  the application: the user adds a table, the table is drawn, the diagram is
  saved and loaded again, the diagram is exported as SQL and the addition of
  the table is undone.
- `e2e/smoke.spec.ts` — 6 specifications of Playwright: the home page, the
  templates, the editor, the addition of a table, the undo and the persistence
  after a reload.
- `e2e/performance.spec.ts` — 3 specifications of Playwright: a hundred tables
  are drawn, only the tables of the viewport are drawn and a drag of a table
  stays below the budget of 500 ms.
- `e2e/playwright.config.ts` — the configuration of the end to end tests; it
  starts the application of the workspace with Vite.

## Differences from the plan

- The plan only lists `e2e/smoke.spec.ts` and `e2e/performance.spec.ts`. The
  tests of Playwright cannot run in the sandbox of the development environment
  (a browser cannot be started there), so the specifications of the plan are
  meant for the CI and an integration specification that runs with the test
  runner of the workspace (`packages/app/src/integration.test.ts`) verifies the
  same flow locally.
- The specification of the border of the viewport was corrected: an element
  that *starts* at the border of the viewport lies outside of it and is
  culled, an element that *ends* at the border stays visible.

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs` → 315 specifications,
  0 failure.
- `pnpm run typecheck` → clean (the core, the SDK, the application and the
  end to end tests).
