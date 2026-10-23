# drawDB for Vue

A Vue 3 + TypeScript rewrite of [drawDB](https://github.com/drawdb-io/drawdb), split
into a framework independent core, an embeddable SDK and a standalone application.

```
sdk-workspace
├── packages
│   ├── core        @drawdb/core        the data model, the SQL and DBML, the commands
│   ├── sdk         @drawdb/vue-sdk     the Vue components, the stores, the composables
│   └── app         drawdb-vue-app      the standalone editor
├── e2e            the Playwright specifications
├── scripts        the build and the test helpers
└── docs           the specification, the plan and the reports of the tasks
```

## The packages

| Package | Description |
| --- | --- |
| [`@drawdb/core`](packages/core/README.md) | the data model, the commands, the SQL and DBML readers and writers, the storage adapters, the metadata registry and the plugin system. No dependency on Vue. |
| [`@drawdb/vue-sdk`](packages/sdk/README.md) | the `DrawDBEditor` component, the Pinia stores and the composables that a host application embeds. |
| [`drawdb-vue-app`](packages/app/README.md) | the standalone editor with the list of the diagrams, the templates and the routing. |

## The quick start

```bash
pnpm install --ignore-scripts
pnpm --filter drawdb-vue-app dev
```

The editor is embedded into an own application with one component:

```vue
<script setup lang="ts">
import { DrawDBEditor } from "@drawdb/vue-sdk";
</script>

<template>
  <DrawDBEditor database="postgres" auto-save />
</template>
```

## What the SDK offers

- an ERD canvas with the tables, the relationships, the notes, the areas, the views and
  the enums of a diagram, a physical and a logical view and the virtualization of a
  large diagram
- the import and the export of SQL for MySQL, PostgreSQL, SQLite, MariaDB, MS SQL,
  Oracle and a generic dialect
- the import and the export of DBML
- the undo and the redo of every change
- the custom properties of the entities (the metadata) and a plugin system with the
  extension points `toolbar`, `context-menu`, `panel`, `dialog`, `command`, `field-type`
  and `export-format`
- the local storage in the IndexedDB of the browser and a controlled mode for a host
  application that keeps the diagrams itself
- the 51 locales of the original drawDB

## The development

| Command | Description |
| --- | --- |
| `pnpm dev` | starts the development server of the application |
| `pnpm build` | builds every package |
| `pnpm build:packages` | builds the distribution of the core and of the SDK |
| `pnpm test` | runs the specifications of the workspace in a single process |
| `pnpm test:all` | builds the two packages and runs the specifications |
| `pnpm typecheck` | checks the types of the core, of the SDK, of the application, of the example and of the e2e specifications |
| `pnpm e2e` | runs the Playwright specifications (a browser is needed) |
| `pnpm --filter @drawdb/core build` | builds the distribution of the core |
| `pnpm --filter @drawdb/vue-sdk build` | builds the distribution of the SDK |

The specifications of the workspace run with the test runner of Node
(`scripts/run-tests.mjs`), because the sandboxed Windows environment blocks the child
processes that vitest and `node --test` spawn. The specification of the artifacts
(`scripts/verify-artifacts.test.ts`) needs the distribution of the packages, so
`pnpm test` has to follow `pnpm build:packages` (`pnpm test:all` does both).

## The release

The development stage does not publish to npm. The packages are packed locally
and can be installed from the tarball:

| Command | Description |
| --- | --- |
| `pnpm run pack:packages` | packs the two packages into `.release/*.tgz` |
| `npm install ../.release/drawdb-core-0.1.0.tgz` | installs the core from the tarball |

The tag `v0.1.0` triggers `.github/workflows/release.yml`, which checks the
workspace, builds the packages, runs the tests and uploads the tarballs as an
artifact of the workflow. The publication to npm is added back when the packages
are ready for the registry. The changes of every version are written in
[CHANGELOG.md](CHANGELOG.md).

## The documentation

| Document | Description |
| --- | --- |
| [docs/spec.md](docs/spec.md) | the specification of the SDK |
| [docs/plan.md](docs/plan.md) | the plan with the 20 tasks of the implementation |
| [docs/task-N-report.md](docs) | the report of every task |
| [progress.md](progress.md) | the ledger with the state of the work and the decisions |
| [CHANGELOG.md](CHANGELOG.md) | the changes of every version |
| [examples/vue-embed](examples/vue-embed) | an application that embeds the editor |

## The license

The project follows the license of the original drawDB.
