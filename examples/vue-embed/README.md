# Embedding the drawDB editor in a Vue application

The harness of the workspace. It embeds the editor of `@drawdb/vue-sdk` and the
standalone application `drawdb-vue-app`, and it labels the three regions that
a test of an editor is made of.

## The three regions

Both pages of the harness are divided the same way, and every region says who
owns it:

| Region | Owner | What it holds |
| --- | --- | --- |
| **TEST PANEL & BUTTON AREA** | the host application | the buttons that drive the editor, the state of the diagram and the log of the test |
| **SDK COMPONENT AREA** | `@drawdb/vue-sdk` (or `drawdb-vue-app` on top of it) | the editor itself: the header, the toolbar, the side panel and the canvas |
| **TEST CORE AREA** | the test | what the test asserts on: the tables, the relationships, the database and the last save |

## The two pages

- **SDK test page** — the editor of the SDK is mounted directly with `v-model`.
- **drawdb-vue-app test page** — the real application is mounted: `AppHost.vue`
  creates a child Vue application with the router and the pinia of
  `packages/app` and mounts its `App.vue`, so the page shows the product as it
  is shipped, not a copy of it.

## The editor of the SDK

- the editor takes over the whole height of the page,
- the diagram is handed to the editor with `v-model` (the controlled mode), so
  the application always knows the current diagram,
- the application installs the pinia, because the stores of the SDK need it.

## Run it

```bash
pnpm install
pnpm --filter drawdb-vue-embed-example run dev
```

The example runs against the sources of the workspace (the aliases of
`vite.config.ts` point at `packages/core/src` and at `packages/sdk/src`), so a
change of the SDK is visible without a build.

## The relevant part

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import type { Diagram } from "@drawdb/core";

const diagram = ref<Diagram | undefined>(/* the diagram of the application */);
</script>

<template>
  <DrawDBEditor v-model="diagram" database="mysql" @save="onSave" />
</template>
```

## Without the controlled mode

An application that does not need the diagram can leave the value to the editor
and use `initialValue` instead:

```vue
<DrawDBEditor :initial-value="diagram" database="mysql" />
```

The events of the editor (`change`, `save`, `export-sql`, `import-sql`, `error`
and `select`) report what happens inside it. The methods of the instance
(`save`, `exportSql`, `exportDbml`, `importSql` and `runCommand`) are exposed
with a template reference.
