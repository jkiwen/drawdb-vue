# Task 1 Report: Bootstrap Monorepo Infrastructure

## Status

DONE

## Summary

The drawDB Vue 3 SDK monorepo has been bootstrapped with pnpm workspaces, three packages (`@drawdb/core`, `@drawdb/vue-sdk`, `drawdb-vue-app`), strict TypeScript, ESM-first output, CSS Modules constraints, and a CI workflow. The workspace bootstrap verification test passes using Node’s built-in test runner because the DSH sandbox blocks `vitest`/`esbuild` child-process spawns.

## Files created / modified

- `package.json` — root workspace manifest with `pnpm` workspace config, shared scripts (`dev`, `build`, `test`, `test:workspace`, `lint`, `changeset`), and dev dependencies (`turbo`, `typescript`, `vitest`).
- `pnpm-workspace.yaml` — workspace globs `packages/*`.
- `turbo.json` — Turborev pipeline for `build`, `test`, and `lint` with `^build` dependency for dependent tasks.
- `tsconfig.base.json` — shared strict TypeScript configuration with `module: "ESNext"`, `moduleResolution: "Bundler"`, `strict: true`, and `verbatimModuleSyntax: true`.
- `packages/core/package.json` — `@drawdb/core` manifest with CJS+ESM `tsup` build, `dev`/`build`/`test`/`lint` scripts, and exports map.
- `packages/sdk/package.json` — `@drawdb/vue-sdk` manifest with `vue-tsc` + Vite build, peer dependency on `vue`, workspace dependency on `@drawdb/core`, and CSS export.
- `packages/app/package.json` — `drawdb-vue-app` private manifest with Vite dev/build/preview scripts, workspace dependencies on `@drawdb/core` and `@drawdb/vue-sdk`.
- `.github/workflows/ci.yml` — GitHub Actions CI that installs pnpm, runs `pnpm install --frozen-lockfile`, and executes `pnpm lint`, `pnpm build`, and `pnpm test`.
- `scripts/verify-workspace.test.ts` — bootstrap verification test asserting package existence, names/types, workspace config, `turbo.json` pipeline, `tsconfig.base.json` strictness, and CI workflow presence.
- `.gitignore` — ignores `node_modules`, `dist`, `.output`, logs, `.env`, and pnpm store.

## Commands run and results

### pnpm install

```text
pnpm install
```

`pnpm` v11.28.5 installed dependencies, but the resulting symlinks on Windows are prefixed with `Global\` and cannot be resolved by Node, and the DSH sandbox blocks `esbuild` from spawning its service. Therefore the documented `pnpm exec vitest run scripts/verify-workspace.test.ts` command cannot run in this environment.

### Bootstrap verification test (Node test runner fallback)

```text
node --experimental-strip-types scripts/verify-workspace.test.ts
```

Result:

```text
▶ workspace bootstrap
  ✔ has three packages (0.8064ms)
  ✔ core package has correct name and type (0.3899ms)
  ✔ sdk package has correct name and type (0.3277ms)
  ✔ app package has correct name and type (0.2978ms)
  ✔ workspace config includes all packages (0.2753ms)
  ✔ turbo config exists and has pipeline (0.3188ms)
  ✔ shared typescript base config exists (0.4022ms)
  ✔ ci workflow exists (0.2342ms)
✔ workspace bootstrap (4.0414ms)
ℹ tests 8
ℹ suites 1
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10.2879
```

All 8 assertions pass.

## Commit hash

`2b3b5c3c86e8a7c2c96157c7274a824f7420252c`

## Concerns / blockers

1. **vitest/esbuild cannot execute in the DSH sandbox.** Running `pnpm exec vitest run scripts/verify-workspace.test.ts` fails with `Error: spawn EPERM` because `esbuild` attempts to spawn a child process and the sandbox denies it. The bootstrap verification therefore uses Node’s built-in test runner (`node --test` APIs) invoked directly with `--experimental-strip-types`.
2. **pnpm v11.28.5 Windows symlinks are broken in this environment.** Symlink targets are written with a `Global\` prefix (e.g. `Global\D:\...`) which Node resolves as `ENOENT`. This is an environment/pnpm interaction issue, not a workspace configuration issue.
3. **No lint/build execution yet.** ESLint and Vite/tsup build scripts are configured but not run in this task; they should be validated in Task 2+ or once the sandbox allows child-process spawns.
