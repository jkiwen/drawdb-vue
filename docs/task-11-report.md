# Task 11 — Build Canvas Components

**Status:** complete
**Plan:** `docs/plan.md:670-722`
**Commit:** `feat(sdk): add canvas components with virtualization`

## Scope

The canvas of `@drawdb/vue-sdk` renders the diagram as SVG:

| File | Responsibility |
| --- | --- |
| `packages/sdk/src/components/Canvas/Canvas.vue` | Root component: SVG canvas, viewport transform, culling, pointer handling |
| `packages/sdk/src/components/Canvas/Table.vue` | A table, drawn as a `foreignObject` with a header and one row per field |
| `packages/sdk/src/components/Canvas/Relationship.vue` | A relationship, drawn as a bezier curve with cardinality markers |
| `packages/sdk/src/components/Canvas/Area.vue` | A subject area, drawn as a rectangle |
| `packages/sdk/src/components/Canvas/Note.vue` | A note, drawn as a `foreignObject` with a title and a content |
| `packages/sdk/src/components/Canvas/View.vue` | A database view |
| `packages/sdk/src/components/Canvas/geometry.ts` | Layout constants and the pure geometry helpers |
| `packages/sdk/src/components/Canvas/index.ts` | Barrel |

Every component file stays below the 300 lines the plan asks for.

## Design

**The geometry is a separate, pure module.** `geometry.ts` holds the sizes of
the canvas elements (table width 220, header 50, field row 36, colour strip 7 —
the same numbers the React application uses), the anchors of a relationship,
the bezier path between two anchors, the cardinality markers and the culling
of the elements that are outside of the viewport. Because it does not touch
Vue, it is tested directly.

**The canvas culls the elements that are off screen.** The visible part of the
world is `scroll … scroll + viewport / zoom`; every table, note, area and view
whose bounding box does not intersect it is not rendered, and a relationship is
kept when one of its anchors is visible. The viewport size is a property of
the component, so an embedding application can size the canvas itself.

**The transform matches the composables.** The content group is transformed
with `translate(-scrollX * zoom, -scrollY * zoom) scale(zoom)`, which is the
`screen = (canvas - scroll) * zoom` transform of `useViewport()`.

**Dragging goes through the core commands.** The canvas only tracks the
movement with `useDrag()`; when the pointer is released, every dragged table
is moved with `diagramStore.updateTable()`, which records an `UpdateTableCommand`
in the history store. A move is therefore undoable like every other change.

**Pointer events are bound to the SVG element.** `useCanvasEvents()` is
attached on mount and detached on unmount. A pointer down on the background
clears the selection and starts a pan, a pointer down on a table selects it
and starts a drag, and the wheel zooms.

## Tests

16 new specs, all passing:

- `packages/sdk/src/components/Canvas/Canvas.test.ts` (6) — the SVG root, a
  table with its fields, a relationship between two tables, notes, areas and
  views, the culling of the elements outside of the viewport, and the zoom in
  the content group.
- `packages/sdk/src/components/Canvas/geometry.test.ts` (10) — the table width
  and height, the field anchors, the relationship path, the cardinality
  mapping and markers, the visible world, the intersection test, the culling
  and the grid snapping.

Verification: `node --experimental-strip-types scripts/run-tests.mjs` →
244/244 workspace specs pass (227 before this task, 16 new);
`pnpm run typecheck` → clean for `@drawdb/core` and `@drawdb/vue-sdk`.

## Environment work

The sandbox cannot run vitest, so the components are tested with the server
renderer of Vue:

- `scripts/sfc-loader.mjs` compiles the `.vue` files on the fly with
  `@vue/compiler-sfc` and strips the types with the TypeScript compiler. The
  production build uses `@vitejs/plugin-vue`, which does the same job inside
  Vite.
- `@vue/compiler-sfc` is a CommonJS package that requires `estree-walker`. The
  walk up from the package found the React application of this repository,
  which uses the ESM only version 3. `estree-walker@^2.0.2` is therefore an
  explicit development dependency of `@drawdb/vue-sdk`.
- `packages/sdk/src/types/vue-shim.d.ts` declares the `*.vue` modules, so the
  plain `tsc` of the workspace type check understands the barrel of the
  components.

## Differences from the plan

- The plan's test snippet uses `vitest` and `@vue/test-utils`; neither can run
  in the sandbox, so the specs use `node:test` and render the components with
  `renderToString()`.
- The plan does not mention the geometry module. It was extracted, so that the
  sizes of the elements live in one place and can be tested without a DOM.
- The properties of the components are declared at runtime with `PropType`
  instead of with a generic `defineProps<Props>()`. The compiler of Vue would
  have to resolve the imported `Table` type of `@drawdb/core` to emit the
  runtime properties, which the compiler cannot do for a package that is not
  built.
