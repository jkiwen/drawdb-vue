# SDD ledger — plan: docs/plan.md

## Preflight
- Workspace: D:\dev\repos\github\drawdb\sdk-workspace
- Source reference: D:\dev\repos\github\drawdb (React drawDB for migration reference)
- Execution method: Subagent-driven development

## Decisions
- SDK workspace is nested inside the drawDB repo because the file sandbox denies creating directories at the sibling level (`D:\dev\repos\github\drawdb-vue-sdk`). This is a workspace-location concession, not a code-structure concession; the SDK still ships as three independent packages from `packages/*`.

## Rulings
- **Task 1: Ruling: subagent-driven development unavailable — switched to inline execution** — Two subagent dispatches returned no files and no report; the harness appears not to complete subagent work in this environment. Cost if wrong: no per-task fresh context; mitigated by reading the brief, TDD, and a final review.
- **Task 1: Ruling: SDK workspace nested inside drawDB repo** — File sandbox denies creating `D:\dev\repos\github\drawdb-vue-sdk`; workspace lives at `D:\dev\repos\github\drawdb\sdk-workspace`. Cost if wrong: not a true independent repo; mitigated by separate Git history and `packages/*` layout.
- **Task 1: Ruling: package skeletons keep minimal devDependencies in Task 1** — Full build-toolchain deps (tsup, vite, vue-tsc, pinia, vue) would be added in the tasks that use them. Cost if wrong: Task 1 passes but later tasks must add deps; tracked in their briefs.
- **Task 1: Ruling: `.npmrc` uses `node-linker=hoisted`** — pnpm isolated linker + Node v26 in this Windows sandbox cannot resolve transitive symlinks correctly; hoisted linker makes install exit 0. Cost if wrong: flatter node_modules; no behavioral impact on SDK output.
- **Task 1: Ruling: verification uses `node scripts/verify-workspace.mjs` instead of `pnpm exec vitest run scripts/verify-workspace.test.ts`** — The sandbox throws `EPERM` when vitest/esbuild or `node --test` spawn child processes with piped stdio. Cost if wrong: one less test-runner assertion API; same file-existence/JSON checks are executed.

## Task Progress
- Task 1: complete (tests: `node scripts/verify-workspace.mjs` → "workspace bootstrap verification passed")
