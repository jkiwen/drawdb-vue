# Task 19 — Documentation & Packaging

## Scope

The plan asks for the documentation and the packaging of the workspace:

- a readme for the core, for the SDK, for the application and for the workspace,
- a build configuration that produces a publishable distribution with the type
  declarations,
- a specification that verifies the artifacts of the build.

## Dependencies

- `packages/core/tsconfig.build.json` and `packages/sdk/tsconfig.build.json` (the build
  configurations of the two packages).
- `@vue/compiler-sfc` and the TypeScript compiler (the build of the SDK).
- `scripts/dom.mjs` (the DOM of the test runner).

## The build of the core

The core is compiled by `tsc` alone:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "rewriteRelativeImportExtensions": true,
    "noEmitOnError": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`rewriteRelativeImportExtensions` rewrites the explicit `.ts` specifiers of the sources
into `.js`, so that the distribution runs in Node without a bundler. The result is an
ESM module with the declarations next to it (`packages/core/dist/index.js` and
`packages/core/dist/index.d.ts`).

The build script of the package is `tsc -p tsconfig.build.json`. `tsup` was removed:
it needs esbuild, and the esbuild service cannot be started in the sandbox of the
development environment.

## The build of the SDK

`vue-tsc` compiles the single file components, but it emits only the **script** of a
component (`defineComponent({ props, setup })`) — the template is missing in the
emitted `DrawDBEditor.vue.js`. A component without a template renders nothing.

The build therefore has two steps:

1. `vue-tsc -p tsconfig.build.json --noCheck` writes the modules and the declarations.
   `--noCheck` is needed because `rewriteRelativeImportExtensions` refuses to rewrite
   the `.vue` specifiers (`error TS2876: This relative import path is unsafe to
   rewrite`). The type checking is not skipped, it happens in `pnpm run typecheck`.
2. `scripts/build-sdk.mjs` replaces every emitted `<name>.vue.js` with the component
   that `@vue/compiler-sfc` compiles (the script and the template inlined as a render
   function) and rewrites the relative specifiers of the emitted modules
   (`./Component.vue` → `./Component.vue.js`, `./stores/ui.ts` → `./stores/ui.js`).

The script runs in-process, so it also works in an environment that blocks the process
spawning of esbuild.

The declarations of the SDK keep the `.vue` specifiers
(`export { default as DrawDBEditor } from "./DrawDBEditor.vue";`). A consumer of the
package resolves them to `DrawDBEditor.vue.d.ts`, which is emitted next to the
component.

### The bug of the build: the sources of the core in the program of the SDK

The `paths` of the SDK point `@drawdb/core` at the sources of the core
(`../core/src/index.ts`), so that the development server sees the changes of the core
without a build. The build configuration inherited that mapping, and the compiler
emitted the **sources of the core into their own source folder** (a `.js` file next to
every `.ts` file of `packages/core/src`).

The build configuration of the SDK now points the mapping at the built declarations:

```json
"paths": {
  "@drawdb/core": ["../core/dist/index.d.ts"]
}
```

The build of the SDK therefore needs the build of the core, which the pipeline of turbo
already orders (`"build": { "dependsOn": ["^build"] }`).

## The readmes

| File | Content |
| --- | --- |
| `README.md` | the workspace: the packages, the quick start, the commands, the documentation |
| `packages/core/README.md` | the data model, the SQL and the DBML, the commands, the storage, the metadata and the plugins |
| `packages/sdk/README.md` | the editor component, its properties and events, the stores, the composables and the plugins |
| `packages/app/README.md` | the routes of the application, the structure and the storage |

## The verification of the artifacts

`scripts/verify-artifacts.test.ts` checks the distribution instead of the sources:

- the core publishes `dist/index.js` and `dist/index.d.ts`, and the `types` field of
  the manifest points at an existing file,
- the SDK publishes `dist/index.js` and `dist/index.d.ts`,
- the built core exports the public API (`createEmptyDiagram`, `exportSQL`,
  `importSQL`, `exportDBML`, `parseDBML`, `CommandManager`, the storage adapters, the
  metadata registry and the plugin manager),
- the built SDK exports `DrawDBEditor` and the stores,
- the built SDK **renders**: the editor is mounted with the test utils and the markup
  has to contain the canvas and the side panel,
- the distribution contains the locales.

The specification has to run after a build, so the CI builds the packages before it
runs the specifications.

### The bug of the specification: a second realm of the DOM

The specification installed the DOM of `scripts/dom.mjs` a second time, although the
test runner already installs it before the specifications are imported. The second
jsdom replaced the globals, so that the elements of the first realm were no longer
instances of the global `Element` and Naive UI failed with

```
TypeError: Failed to execute 'observe' on 'ResizeObserver': parameter 1 is not of type 'Element'
```

A specification must not install the DOM again. The test runner owns it.

## The type errors that `vue-tsc` found

The plain `tsc` never checks the templates of the components. `vue-tsc --noEmit` found
13 errors, all of them fixed:

- `stores/diagram.ts` — the index signature of the parameter of `addEntity` made the
  models of the core unassignable (the `DiagramEntity` of the core has no index
  signature).
- `utils/elements.ts` — `uniqueTableName` accepted only tables, but it is called with
  the areas.
- `components/Header/types.ts` — `MenuBarItem` and `MenuBarGroup` were interfaces;
  Naive UI describes its entries with an index signature, and an interface without one
  is not assignable to it. They are type aliases now.
- `components/DrawDBEditor.vue` — an unused generic parameter.
- `components/SidePanel/SidePanel.vue` — three unused imports.

## Differences from the plan

- The plan asks for `vite build` / `tsup`. Neither can run in the sandbox of the
  development environment (esbuild spawns a service process, which is blocked), and
  `vue-tsc` alone does not compile the templates. The build of the SDK therefore uses
  `@vue/compiler-sfc` directly. The application is still built with vite.
- The plan has no specification of the artifacts, the readmes and the build
  configuration. The specification checks the artifacts, because a build that cannot be
  imported is not a build.

## Tests

- `scripts/verify-artifacts.test.ts` — 6 specifications, all of them pass.
- The whole workspace: 321/321 specifications pass.
- `pnpm run typecheck` — clean for the core, the SDK, the application and the e2e
  specifications.
- `pnpm --filter @drawdb/core run build` and
  `pnpm --filter @drawdb/vue-sdk run build` — both exit with 0.
