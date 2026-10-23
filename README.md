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
| `pnpm test:node` | runs the specifications of the workspace in a single process |
| `pnpm typecheck` | checks the types of the core, the SDK, the application and the e2e specifications |
| `pnpm e2e` | runs the Playwright specifications (a browser is needed) |
| `pnpm --filter @drawdb/core build` | builds the distribution of the core |
| `pnpm --filter @drawdb/vue-sdk build` | builds the distribution of the SDK |

The specifications of the workspace run with the test runner of Node
(`scripts/run-tests.mjs`), because the sandboxed Windows environment blocks the child
processes that vitest and `node --test` spawn.

## The documentation

| Document | Description |
| --- | --- |
| [docs/spec.md](docs/spec.md) | the specification of the SDK |
| [docs/plan.md](docs/plan.md) | the plan with the 20 tasks of the implementation |
| [docs/task-N-report.md](docs) | the report of every task |
| [progress.md](progress.md) | the ledger with the state of the work and the decisions |

## The license

The project follows the license of the original drawDB.
