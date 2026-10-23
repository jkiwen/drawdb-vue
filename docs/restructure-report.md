# The restructure of the repository

## The scope

The React application of drawDB was the starting point of the work. It stays
in the repository as a reference, but it is not the project any more: the
project is the Vue workspace in `sdk-workspace`.

| Path | Content |
| --- | --- |
| `sdk-workspace/` | the project: the packages, the application, the example and the documentation |
| `drawdb-app/` | the reference: the original React application, unmodified and still runnable |
| `drawdb-history.bundle` | the complete history of the original repository (`git bundle verify` reports a complete history) |

## What was done

1. **The history was saved.** `git bundle create drawdb-history.bundle --all`
   writes the branches, the tags and the commits of the original repository into
   one file. `git bundle verify drawdb-history.bundle` reports
   "The bundle contains this ref: refs/heads/main ... The bundle records a
   complete history." The history can be restored with
   `git clone drawdb-history.bundle <directory>`.
2. **The React application was moved into `drawdb-app/`.** The directories
   (`.github`, `.husky`, `.vscode`, `src`, `public`, `node_modules`) and the
   files of the root were moved as they were, so the application still starts
   with `npm run dev` in that directory.
3. **The store of pnpm was deleted** (`.pnpm-store`, 328 MB). It was a leftover
   of an installation of the root and is not used any more.
4. **The documentation of the work was moved** into `sdk-workspace/docs/`
   (`docs/superpowers/plans` and `docs/superpowers/specs`, the copies of the
   plan and of the specification) and the empty `docs/` of the root was
   removed.
5. **The git configuration of the root was removed.** The `.git` of the outer
   repository was deleted, so the root is not a repository any more. The
   repository of `sdk-workspace/` is a separate repository with its own
   history (39 commits at the time of the restructure) and **no remote**: the
   work is not pushed anywhere.
6. **The publication to npm was replaced by a local packing.** The version of
   the packages was rolled back from `1.0.0` to `0.1.0`, the workflow of the
   release only packs the packages, and the root gained the script
   `pack:packages`.

## The rules for the development stage

- The packages are **not** published to npm. `pnpm run pack:packages` writes
  the two tarballs into `.release/`, and they can be installed from there.
- The tag of the version marks the state of the development, it does not
  trigger a publication. The tag of the current state is `v0.1.0`.
- The React application in `drawdb-app/` is a reference. It is not built, not
  type checked and not tested by the workspace, and it is not a member of the
  pnpm workspace.
- The history of the original repository is only in the bundle. The new
  repository starts with the first commit of the Vue workspace.

## The differences from the plan of the restructure

- The bundle is written inside the root of the workspace, because the parent
  directory is outside of the sandbox of the development environment.
- The tag `v1.0.0` was deleted and replaced with `v0.1.0`, because the version
  of the packages was rolled back.

## The tests

- `node --experimental-strip-types scripts/run-tests.mjs` — 327/327
  specifications pass after the restructure.
- `pnpm run typecheck` — clean for the core, the SDK, the application, the
  example and the end to end tests.
- `pnpm run build:packages` — the core and the SDK build without an error.
- `pnpm run pack:packages` — the two tarballs are written into `.release/`.
