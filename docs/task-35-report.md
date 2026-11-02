# Task 35 report: the leftovers of the last stage — the tree that names a relationship by its layer, the history a host can drive, and the canvas that resolves a domain with the rule of the core

The work that the commit of the clickable history left out. The three defects
the user named were closed by that commit — the canvas reads the domains, the
history tab jumps, and the rename of a relationship writes the layer it was
made in — but the tree still named a relationship by its physical name on both
layers, the canvas answered a domain with a rule of its own, the jump of the
history could not be driven by a host, and the return value of the jump did
not say what its own documentation promised. This is that commit.

## What this task did

| Step | Result |
| --- | --- |
| The tree names a relationship after the layer it shows | `packages/sdk/src/components/Outline/outline-labels.ts` — the logical view leads with the logical name and the physical view with the physical one; the name of the other layer is the secondary label (design 3.1: the tree follows the view layer) |
| A rename in the outline is visible in the layer it was made in | the write of `outline-actions.ts` lands in the logical relationship, and the row of the tree now shows that name instead of the physical one |
| The canvas resolves a domain with the rule of the core | `packages/sdk/src/components/Canvas/table-domains.ts` builds the lookup with `scopeWithDiagram` and `findDomainInScope`, the two functions the dialect lint already uses; the render model takes the lookup instead of a map of domains |
| The jump of the history says whether it landed exactly | `packages/core/src/commands/command-manager.ts` — `jumpTo` answers `false` when the position the caller asked for was out of reach, as its documentation promised |
| A host can drive the jump | `use-editor-commands.ts` gains `jumpHistory(depth)`, `DrawDBEditor.vue` exposes it, and `packages/app/src/services/editor-bridge.ts` publishes it on `window.__DRAWDB__` |
| The tests | `packages/sdk/src/stores/history.test.ts` (new), `packages/sdk/src/components/Outline/outline-labels.test.ts` (new), the canvas domain tests, the core tests of the resolver and of the jump |

## The scope of the feature

| Piece | Where |
| --- | --- |
| The name a relationship shows | `relationshipLabels()` in `packages/sdk/src/components/Outline/outline-labels.ts` — the name of the layer the tree shows leads, the name of the other one is the `altLabel` (the tooltip) |
| The write of a rename | `renameOutlineNode()` in `packages/sdk/src/components/Outline/outline-actions.ts` — the logical layer writes the logical relationship (creating the counterpart when the diagram has none), the physical layer writes the physical one |
| The lookup of a domain | `domainLookup()` in `packages/sdk/src/components/Canvas/table-domains.ts` — the diagram's own domains are the diagram layer of the scope, and a domain is found by its name or by its id |
| The label of a logical type | `logicalTypeLabel()` in `packages/sdk/src/components/Canvas/render-model.ts` — the name of the domain, or the id of the domain as a placeholder when no layer knows it |
| The jump of the history | `CommandManager.jumpTo()` in `packages/core/src/commands/command-manager.ts` and `useHistoryStore().jumpTo()` in `packages/sdk/src/stores/history.ts` |
| The entry of a host | `jumpHistory(depth)` on the editor of the SDK and on the bridge of the application |

## The differences with the specification

- **The tree names a relationship after the layer it shows** — the commit
  before this one made the rename write the layer it was made in, but the
  label of the row led with the physical name on both layers, so a logical
  rename only showed up in the tooltip. The tree follows the view layer
  everywhere else (a table is named by its logical name in the logical view,
  an attribute by its logical name), and a relationship is an object of the
  tree like any other: the logical view leads with the logical name, the
  physical view with the physical one, and the other layer's name is the
  tooltip. A layer that carries no name of its own borrows the name of the
  other one, so a relationship that was never named twice is still named.
- **The canvas resolves a domain with the rule of the core** — the canvas
  built its own map of the three layers of the type scope, keyed by the id
  and by the name of every domain. That map is a second answer to the
  question the resolver of the core already answers, and the two could
  disagree: the map let a name shadow the id of another domain. The canvas
  now uses `scopeWithDiagram` and `findDomainInScope`, the two functions the
  dialect lint uses, so a domain the lint knows is the domain the canvas
  prints, and a diagram that carries its own types wins over the scope.
- **The jump of the history reports the exactness of the move** — the
  documentation of `CommandManager.jumpTo` promised that the return value
  says whether the move landed exactly on the position that was asked for,
  and the implementation always answered `true` because it clamped the
  position and walked to the clamped one. It now compares the position it
  landed on with the position that was asked for, so a host learns that a
  position beyond the history was not reached.
- **The jump is part of the API of the editor** — the history tab was the
  only way to jump, so a host that embeds the SDK could not drive the
  history, and the end to end tests could not reach it either. The editor
  exposes `jumpHistory(depth)`, and the bridge of the application publishes
  it, next to the other entries of the bridge.

## The verification

| Check | Result |
| --- | --- |
| `pnpm run typecheck` | clean (core, SDK, application, example, e2e) |
| `node --experimental-strip-types scripts/run-tests.mjs` | 1428 tests, 1428 pass, 0 fail (the same run, filtered by path: core 524, app 40) |
| `pnpm --filter @drawdb/core run build` and `pnpm --filter @drawdb/vue-sdk run build` | OK (the turbo fan out cannot spawn a child process in this sandbox, so the packages are built one by one) |
| `pnpm --filter drawdb-vue-app run build` | the type check of the application passes; the bundling of vite cannot run here (esbuild is spawned, and the sandbox denies it: `spawn EPERM`) |
| `pnpm run e2e` | not runnable here: Playwright cannot fork its worker (`spawn EPERM`) |

## The commits of this task

| Commit | What it carries |
| --- | --- |
| `b09108b` | core: a domain of the diagram is found by its name as well as by its id |
| `7444760` | core: the jump of the history says when it landed somewhere else |
| `41604cd` | SDK: the canvas resolves a domain with the rule of the core |
| `01112dd` | SDK: the outline names a relationship after the layer it shows |
| `2d5cbdb` | SDK: a host application can drive the history of the editor |
| `a8c621a` | app: the bridge of the editor jumps the history too |
| `f285fea`, `c79c465` and the commit of this file | the ledger and this report |

The new specifications of this task: `packages/sdk/src/stores/history.test.ts`
(the jump of the store: back, forward, over the boundary, clamped, and the
mirrors of the command manager), `packages/sdk/src/components/Outline/outline-labels.test.ts`
(the two names of a relationship per layer),
`packages/sdk/src/components/Canvas/table-domains.test.ts` (the lookup of a
domain), `packages/core/src/commands/command-manager.test.ts` (the exactness of
the jump) and `packages/core/src/types/diagram-scope.test.ts` (the domain of a
diagram found by its name as well as by its id).
