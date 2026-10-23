# @drawdb/vue-sdk

The Vue 3 components and composables of drawDB. The package contains the editor
component `DrawDBEditor`, the Pinia stores that hold the state of the editor, the
composables that implement the interaction of the canvas and the plugin system.

```bash
npm install @drawdb/vue-sdk vue pinia
```

## The editor component

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DrawDBEditor } from "@drawdb/vue-sdk";

const diagram = ref();
</script>

<template>
  <DrawDBEditor v-model="diagram" database="postgres" />
</template>
```

The component renders the header, the side panel and the canvas. It works in two
modes:

- **controlled** — the `v-model` property holds the diagram, the editor changes it and
  emits `update:modelValue`.
- **uncontrolled** — the `initialValue` property holds the diagram, the editor owns it
  and emits `change` for every modification.

### Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `modelValue` | `Diagram` | – | the diagram of a controlled editor |
| `initialValue` | `Diagram` | – | the diagram of an uncontrolled editor |
| `database` | `DatabaseType` | `generic` | the database of the diagram |
| `viewMode` | `"physical" \| "logical"` | `physical` | the fields or the entities of the canvas |
| `readonly` | `boolean` | `false` | hides the side panel and the editing |
| `locale` | `string` | `en` | the language of the user interface |
| `theme` | `"light" \| "dark"` | `light` | the theme of the user interface |
| `plugins` | `SDKPlugin[]` | `[]` | the plugins that are activated |
| `metadataSchema` | `MetadataSchema` | – | the custom properties of the entities |
| `customTypes` | `CustomType[]` | – | the additional types of the diagram |
| `storage` | `StorageAdapter` | – | where the diagrams are stored |
| `autoSave` | `boolean` | `false` | saves the diagram by itself |
| `autoSaveInterval` | `number` | `5000` | the delay between two saves in milliseconds |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `update:modelValue` | `Diagram` | the diagram changed (controlled mode) |
| `change` | `Diagram`, `ChangeInfo` | the diagram changed |
| `save` | `Diagram` | the diagram was saved |
| `export-sql` | `string` | the SQL of the diagram was requested |
| `export-dbml` | `string` | the DBML of the diagram was requested |
| `import-sql` | `string` | SQL was imported |
| `error` | `Error` | something went wrong |
| `select` | `EditorSelection` | the selection changed |

### Methods

The component exposes its methods, so that a host application can drive the editor.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DrawDBEditor } from "@drawdb/vue-sdk";

const editor = ref<InstanceType<typeof DrawDBEditor>>();
</script>

<template>
  <DrawDBEditor ref="editor" />
  <button @click="editor?.exportSql()">Export</button>
</template>
```

| Method | Description |
| --- | --- |
| `save()` | saves the diagram with the storage adapter |
| `exportSql()` | returns the SQL of the diagram |
| `exportDbml()` | returns the DBML of the diagram |
| `importSql(sql, database?)` | replaces the diagram with an imported one |
| `runCommand(key)` | runs a command that a plugin registered |
| `getDiagram()` | returns the current diagram |

## The stores

The state of the editor lives in five Pinia stores. They are available for a host
application that builds its own user interface around the canvas.

```ts
import { useDiagramStore, useHistoryStore, useUIStore } from "@drawdb/vue-sdk";

const diagram = useDiagramStore();
const history = useHistoryStore();
const ui = useUIStore();

diagram.addTable({ id: "t1", name: "users", x: 0, y: 0, fields: [] });
history.undo();
ui.setActiveTab("tables");
```

| Store | Content |
| --- | --- |
| `useDiagramStore` | the diagram and the actions that change it |
| `useHistoryStore` | the commands, the undo and the redo |
| `useUIStore` | the selection, the zoom, the active tab, the view mode |
| `useSettingsStore` | the preferences of the user |
| `useSaveStore` | the storage adapter and the state of the last save |

## The composables

| Composable | Purpose |
| --- | --- |
| `useSelection()` | the selection of the canvas |
| `useViewport()` | the zoom and the scrolling of the canvas |
| `useDrag()` | the drag of the entities |
| `useHotkeys()` | the keyboard shortcuts |
| `useCanvasEvents()` | the pointer, the wheel and the keyboard events of an element |
| `useStorage()` | the storage adapter of the editor |
| `useVirtualization()` | the visible elements of a large canvas |

## The plugins

A plugin extends the editor. It receives the stores of the editor and can register a
slot, a command and a metadata schema.

```ts
import type { SDKPlugin } from "@drawdb/vue-sdk";

const plugin: SDKPlugin = {
  id: "my-plugin",
  name: "My plugin",
  version: "1.0.0",
  activate(context) {
    context.registerCommand("my-plugin:hello", () => {
      context.diagramStore.updateDiagram({ title: "Hello" });
    });
    context.registerMetadata({
      id: "owner",
      name: "Owner",
      target: "table",
      properties: [{ key: "owner", type: "string" }],
    });
  },
};
```

```vue
<DrawDBEditor :plugins="[plugin]" />
```

## The locales

The package ships the locales of the original drawDB (51 languages). The language of
the editor is chosen with the `locale` property.

```ts
import { createI18n, resolveLocale, setLocale, t } from "@drawdb/vue-sdk";

await createI18n("de"); // an own vue-i18n instance for the host application
setLocale("zh-CN");
t("add_table");
```

## Building

```bash
pnpm --filter @drawdb/vue-sdk build
```

The build runs `vue-tsc` for the type declarations and compiles the single file
components with `@vue/compiler-sfc` into ESM modules. The result is in
`packages/sdk/dist`.
