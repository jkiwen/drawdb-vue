# Task 10 — Implement Canvas Composables

**Status:** complete
**Plan:** `docs/plan.md:609-666`
**Commit:** `feat(sdk): add canvas composables`

## Scope

The composables of `@drawdb/vue-sdk` hold the interaction state of the canvas
and give the components a single API to change it:

| File | Responsibility |
| --- | --- |
| `packages/sdk/src/composables/use-selection.ts` | Selection of tables, relationships, notes and areas |
| `packages/sdk/src/composables/use-viewport.ts` | Zoom, scroll and the screen ⇄ canvas coordinate transform |
| `packages/sdk/src/composables/use-drag.ts` | Drag state machine (origin, delta, snapped origin) |
| `packages/sdk/src/composables/use-hotkeys.ts` | Keyboard shortcut registry |
| `packages/sdk/src/composables/use-canvas-events.ts` | Pointer and wheel listeners, throttled to animation frames |
| `packages/sdk/src/composables/use-storage.ts` | Binds the editor to a `StorageAdapter` |
| `packages/sdk/src/composables/pinia.ts` | Resolves the active pinia instance |
| `packages/sdk/src/composables/index.ts` | Barrel |

## Design

**State lives in the stores, the composables are the API.** The selection and
the viewport are part of the UI store, because several components — the
canvas, the sidebar, the toolbar — have to see the same state. The
composables are the functions the components call; they add the semantics
that the raw store does not provide, such as resolving the kind of an id from
the diagram or converting a screen position into a canvas position.

**The composables work without a component setup.** `resolvePinia()` returns
the active pinia instance, or a shared fallback instance when there is none.
That keeps the composables usable in plain unit tests, where no application
is mounted, without duplicating the state implementation.

**The drag composable does not change the diagram.** It tracks the origin,
the current position and the delta, and hands the result to the caller. The
caller turns the result into a core command, which is what makes a move
undoable. The origin can be snapped to a grid.

**The hotkey registry is DOM free.** `createHotkeyRegistry(platform)` holds
the registrations and matches them against a keyboard event. The platform
only matters for the `mod` modifier, which means control on Windows and
Linux and command on macOS. Handlers run in descending priority order, and
the first handler that prevents the default stops the remaining ones.

**Pointer moves are throttled to animation frames.** `useCanvasEvents()`
keeps the last pointer event of a frame and delivers it once per frame, so a
fast pointer cannot flood the diagram store with updates.

## Coordinate transform

The canvas applies `screen = (canvas - scroll) * zoom` to its content group.
`useViewport()` exposes the inverse (`toCanvasPoint`) and the forward
(`toScreenPoint`) direction, so a pointer event and a diagram position can be
converted into each other.

## Tests

28 new specs, all passing:

- `packages/sdk/src/composables/use-selection.test.ts` (7) — the scenario of
  the plan, the resolution of the kind of an id, additive selection, toggling,
  selecting many ids, the `hasSelection` flag, and the fallback pinia.
- `packages/sdk/src/composables/use-viewport.test.ts` (6) — zoom clamping and
  stepping, resetting, panning, both coordinate conversions and a round trip.
- `packages/sdk/src/composables/use-hotkeys.test.ts` (9) — normalising a
  binding, the platform dependent `mod` modifier, matching and ignoring,
  several handlers per binding, unregistering, priority order and stopping
  after `preventDefault()`.
- `packages/sdk/src/composables/use-drag.test.ts` (6) — the idle state, the
  tracked movement, the result of a finished drag, cancelling, and snapping
  the origin to the grid.

Verification: `node --experimental-strip-types scripts/run-tests.mjs` →
227/227 workspace specs pass (199 before this task, 28 new);
`pnpm run typecheck` → clean for `@drawdb/core` and `@drawdb/vue-sdk`.

## Differences from the plan

- The plan's test snippet uses `vitest`; the sandbox cannot run vitest, so
  the specs use `node:test` and run in the workspace test runner.
- The plan lists one spec file; four were written, one per composable with
  testable behaviour. `useCanvasEvents` and `useStorage` are thin wrappers
  around the DOM and the save store and are covered by their consumers.
- The plan does not say where the selection state lives. It was kept in the
  UI store, so that the state is shared between the components and remains
  inspectable in the Vue devtools.
