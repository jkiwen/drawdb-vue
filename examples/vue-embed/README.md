# Embedding the drawDB editor in a Vue application

The smallest application that embeds the editor of `@drawdb/vue-sdk`.

## What it shows

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
