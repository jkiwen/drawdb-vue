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
| `autoArrange()` | places the tables of the diagram with the automatic layout |
| `validate()` | returns the issues of the diagram (`DiagramIssue[]`) |
| `openIssuesTab()` | opens the issues panel of the side panel |

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
| `useSelectionStore` | the selection of the canvas and the scroll position, shared by the canvas and the issues panel |

The diagram store carries the actions of the phase 2 features as well:

```ts
diagram.applyRelationships(candidates); // the relationships the inference proposed
diagram.autoArrange(); // the layout of the tables, undoable as one step
diagram.setImportedDiagram(importDiagramJson(file)); // not part of the history
```

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
| `useIssues()` | the localized issues of the diagram |
| `useFullscreen()` | the fullscreen mode of the editor |
| `useImageExport()` | the PNG export of an element (`exportPng`, `ImageExportError`) |

## The canvas

The canvas is an SVG that draws the tables, the relationships, the areas, the
notes and the views. Its look is described in
[the visual parity report](../../docs/visual-parity-report.md); the rules live
in `packages/sdk/src/components/Canvas/canvas.css`, which the canvas imports
(the stylesheet is not scoped, so that the nodes that a compiled template
renders are styled too).

What the user can do on the canvas:

- drag a table, a note, an area or a view
- drag the handle of a field onto another field to draw a relationship
- rename a table, edit its comment, its colour, its indices and its unique
  constraints
- rename a field, edit its type, toggle its primary key and its nullability
- drag the fields of a table to reorder them
- resize a table, lock it, open the details of a table
- delete a field, a table or a relationship

The marks of a field follow the original drawDB: the primary key is a key icon,
a field that accepts the null value shows a question mark, and the type is
painted with the colour of its family.

```ts
import { typeColor } from "@drawdb/core";

typeColor("INTEGER"); // "#eab308" — the colour of the integers
typeColor("VARCHAR"); // "#f97316" — the colour of the strings
```

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

The stylesheet of the canvas is copied into `dist` as well, so that a host
application that imports the package gets the look of the editor without
writing a rule of its own.
