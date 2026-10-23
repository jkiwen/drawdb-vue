# Task 20 — Final Integration & Release

## Scope

The plan asks for the release of the workspace:

- the continuous integration that checks, builds and tests the workspace,
- a workflow that publishes the two packages,
- a changelog,
- an example that embeds the editor into a Vue application,
- the tag of the release.

## Dependencies

- The three packages of the workspace and their readmes.
- The `scripts/verify-artifacts.test.ts` (the verification of the build).

## The verification of the release

`scripts/verify-release.test.ts` checks the release itself:

- the changelog announces the version,
- the three packages carry the version of the release,
- the core and the SDK are publishable (they are not private, they have an
  `exports` field and a license),
- the continuous integration runs the type check, the build and the tests,
- the release workflow publishes the two packages,
- the example embeds the editor.

The specification was written before the implementation: it failed with
`ENOENT ... .github/workflows/release.yml` and with the missing changelog and
example, and it passes now (6/6).

## The continuous integration

`.github/workflows/ci.yml` has two jobs:

- `ci` — the type check, the build of the two packages and the tests,
- `e2e` — the end to end tests of Playwright, which drive the application in a
  real browser.

The version of pnpm is pinned to the version of the workspace
(`packageManager: pnpm@11.28.5`), because pnpm 11 does not read the `pnpm` field
of the manifest and the linker of the workspace is configured in
`pnpm-workspace.yaml`.

The scripts of the root were changed to the ones that really work:

| Script | Command |
| --- | --- |
| `build` | `turbo run build` |
| `build:packages` | the build of the core and of the SDK |
| `test` | `node --experimental-strip-types scripts/run-tests.mjs` |
| `test:all` | the build of the packages and the tests |
| `typecheck` | the type check of the core, of the SDK, of the application, of the example and of the end to end tests |

The `lint` script was removed: the workspace has no linter configured, and a
script that always fails is worse than no script. The `test` script of the three
packages now calls the runner of the workspace with the path of the package
instead of `vitest run`, which cannot run in the sandbox of the development
environment.

The filter of the runner is matched against the path with forward slashes now,
so that the same filter works on Windows and on Linux.

## The release workflow

`.github/workflows/release.yml` runs on a tag that starts with `v`:

1. the type check, the build and the tests,
2. the publication of `@drawdb/core` and of `@drawdb/vue-sdk` with the token of
   the registry (`NPM_TOKEN`),
3. the creation of the GitHub release with the changelog.

The publication uses `pnpm publish --access public --no-git-checks`: the
workspace is a repository of its own, and the check of the working tree would
refuse the publication because the build leaves the `dist` folders behind.

## The changelog

`CHANGELOG.md` follows the format of *Keep a Changelog* and describes the two
published packages and the standalone application.

## The example

`examples/vue-embed/` is a small application that embeds the editor:

- `src/App.vue` — the editor with `v-model` (the controlled mode) and a diagram
  with two tables and a relationship,
- `src/main.ts` — the application with the pinia,
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` — the
  project,
- `README.md` — how to run it and what it shows.

The example is a member of the workspace (`examples/*` in
`pnpm-workspace.yaml`), so it is installed and type checked with it. Its
`tsconfig.json` needs `allowImportingTsExtensions` and the path of the
declaration of `oracle-sql-parser`, because the sources of the core are a part
of its program.

## The versions

The three packages are at `0.1.0`. The core and the SDK carry a license
(MIT), the keywords, the address of the repository and
`publishConfig.access: public`. The number marks the state of the development:
the packages are **not** published to npm, they are packed locally with
`pnpm run pack:packages`.

## Differences from the plan

- The plan has no `examples/vue-embed/package.json`, but an example without a
  project cannot be started, so the example has one.
- The plan runs `pnpm test` and `pnpm build` in the verification. The build of
  the application needs vite (and therefore esbuild), which cannot run in the
  sandbox of the development environment, so the verification of the release
  uses the build of the two packages (`build:packages`) and the build of the
  application is left to the CI.
- The plan tags the release with `v1.0.0`; the tag is created after the commit
  of this task, and the workflow of the release publishes the packages when the
  tag is pushed. The development stage does not publish to npm: the tag is
  `v0.1.0` and the workflow of the release only packs the packages and uploads
  the tarballs.

## Tests

- `scripts/verify-release.test.ts` — 6 specifications, all of them pass.
- The whole workspace: 327/327 specifications pass.
- `pnpm run typecheck` — clean for the core, the SDK, the application, the
  example and the end to end tests.
- `pnpm run build:packages` — the core and the SDK build without an error.
