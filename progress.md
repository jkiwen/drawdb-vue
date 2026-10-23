# SDD ledger — plan: docs/plan.md

## Preflight
- Workspace: D:\dev\repos\github\drawdb\sdk-workspace
- Source reference: D:\dev\repos\github\drawdb (React drawDB for migration reference)
- Execution method: Inline execution (subagent dispatch returned late; Task 1 was completed inline and later reconciled with subagent report)

## Decisions
- SDK workspace is nested inside the drawDB repo because the file sandbox denies creating directories at the sibling level (`D:\dev\repos\github\drawdb-vue-sdk`). This is a workspace-location concession, not a code-structure concession; the SDK still ships as three independent packages from `packages/*`.

## Rulings
- **Task 1: Ruling: SDK workspace nested inside drawDB repo** — File sandbox denies creating `D:\dev\repos\github\drawdb-vue-sdk`; workspace lives at `D:\dev\repos\github\drawdb\sdk-workspace`. Cost if wrong: not a true independent repo; mitigated by separate Git history and `packages/*` layout.
- **Task 1: Ruling: `.npmrc` uses `node-linker=hoisted`** — pnpm isolated linker + Node v26 in this Windows sandbox cannot resolve transitive symlinks correctly; hoisted linker makes install exit 0. Cost if wrong: flatter node_modules; no behavioral impact on SDK output.
- **Task 1: Ruling: verification uses `node --experimental-strip-types scripts/verify-workspace.test.ts` instead of `pnpm exec vitest run scripts/verify-workspace.test.ts`** — The sandbox throws `EPERM` when vitest/esbuild or `node --test` spawn child processes with piped stdio. Cost if wrong: one less test-runner assertion API; same file-existence/JSON checks are executed.

## Task Progress
- Task 1: complete (commit `02194613f38481fe203d0dd502cce496052ee2b4`; tests: `node --experimental-strip-types scripts/verify-workspace.test.ts` → 8/8 pass; report: `docs/task-1-report.md`)
- Task 2: complete (commit `64cd4d26b48c6ac63b10b79f6d8c9bd0fdef4092`; tests: `node --experimental-strip-types packages/core/src/models/index.test.ts` → 3/3 pass)
- Task 3: complete (commit `c7db564137998812b7eedfeb1b67225406b978f9`; tests: `node --experimental-strip-types packages/core/src/commands/command-manager.test.ts` → 6/6 pass)
- Task 4: complete (commit `e3f414716381f76dff0020cfd74f13103257c677`; all 7 SQL export dialects ported; 37/37 tests pass)
  - Report: `docs/task-4-report.md`

## Rulings
- **Task 3: Ruling: Node `--experimental-strip-types` does not support TypeScript parameter properties** — Converted all command classes to explicit constructor assignments. Cost if wrong: slightly more boilerplate; fully equivalent runtime behavior.

## Rulings
- **Task 2: Ruling: model imports use explicit `.ts` extensions** — Node v26 `--experimental-strip-types` resolves ESM specifiers literally. Bundlers (Vite/rollup/tsc with `allowImportingTsExtensions`) accept `.ts` extensions. Cost if wrong: slightly non-standard appearance; mitigated by consistent project-wide convention.
