<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { Component, PropType } from "vue";
import { NConfigProvider, NGlobalStyle, darkTheme, lightTheme } from "naive-ui";
import { setActivePinia } from "pinia";
import {
  MetadataRegistry,
  PluginManager,
  deepClone,
  exportDBML,
  exportSQL,
  importSQL,
} from "@drawdb/core";
import type {
  CustomType,
  DatabaseType,
  Diagram,
  MetadataSchema,
  Plugin,
  StorageAdapter,
} from "@drawdb/core";
import Canvas from "./Canvas/Canvas.vue";
import Header from "./Header/Header.vue";
import SidePanel from "./SidePanel/SidePanel.vue";
import { resolvePinia } from "../composables/pinia.ts";
import { useDiagramStore } from "../stores/diagram.ts";
import { useHistoryStore } from "../stores/history.ts";
import { useSaveStore } from "../stores/save.ts";
import { useUIStore } from "../stores/ui.ts";
import { createArea, createNote, createTable, uniqueTableName } from "../utils/elements.ts";
import type {
  ChangeInfo,
  EditorSelection,
  EditorTheme,
  SDKPlugin,
  SDKPluginContext,
  ViewMode,
} from "../types/sdk-options.ts";

/**
 * The editor of the SDK.
 *
 * The component glues the header, the canvas and the side panel together. It
 * owns the controlled and the uncontrolled mode of the diagram, the automatic
 * saving, the plugin life cycle and the events the host application listens
 * to.
 */

/*
 * The props are declared at runtime. A generic `defineProps<Props>()` would
 * make the Vue compiler resolve the model types of the not yet built
 * `@drawdb/core` package, which it cannot do.
 */
const props = defineProps({
  /** The diagram of the editor. The editor is controlled while it is set. */
  modelValue: { type: Object as PropType<Diagram>, default: undefined },
  /** The diagram the editor starts with. It is only read once. */
  initialValue: { type: Object as PropType<Diagram>, default: undefined },
  /** The database the diagram is written for. */
  database: { type: String as PropType<DatabaseType>, default: undefined },
  /** How the diagram is drawn. */
  viewMode: { type: String as PropType<ViewMode>, default: "physical" },
  /** Whether the diagram can be changed. */
  readonly: { type: Boolean, default: false },
  /** The language of the user interface. */
  locale: { type: String, default: "en" },
  /** The theme of the editor. */
  theme: { type: String as PropType<EditorTheme>, default: "light" },
  /** The plugins the editor activates. */
  plugins: { type: Array as PropType<SDKPlugin[]>, default: () => [] },
  /** A metadata schema the editor registers. */
  metadataSchema: { type: Object as PropType<MetadataSchema>, default: undefined },
  /** Custom types the diagram uses. */
  customTypes: { type: Array as PropType<CustomType[]>, default: () => [] },
  /** Where the diagrams are stored. */
  storage: { type: Object as PropType<StorageAdapter>, default: undefined },
  /** Whether the editor saves the diagram by itself. */
  autoSave: { type: Boolean, default: false },
  /** The delay between two automatic saves, in milliseconds. */
  autoSaveInterval: { type: Number, default: 5000 },
});

const emit = defineEmits<{
  (event: "update:modelValue", diagram: Diagram): void;
  (event: "change", diagram: Diagram, info: ChangeInfo): void;
  (event: "save", diagram: Diagram): void;
  (event: "export-sql", sql: string): void;
  (event: "export-dbml", dbml: string): void;
  (event: "import-sql", diagram: Diagram): void;
  (event: "error", error: Error): void;
  (event: "select", selection: EditorSelection): void;
}>();

// The stores need an active pinia. The SDK falls back to its own instance so
// that the editor also works outside of an application.
setActivePinia(resolvePinia());

const diagramStore = useDiagramStore();
const uiStore = useUIStore();
const historyStore = useHistoryStore();
const saveStore = useSaveStore();

/** The plugins of the editor and the components they contributed. */
const pluginManager = new PluginManager();
const metadataRegistry = new MetadataRegistry();
const pluginSlots = ref<Record<string, Component>>({});
const pluginCommands = new Map<string, () => void>();

/** The diagram the editor emitted last, so that its echo is ignored. */
let lastEmitted: Diagram | undefined;

const theme = computed(() => (props.theme === "dark" ? darkTheme : lightTheme));
const showSidePanel = computed(() => !props.readonly && uiStore.sidebarOpen);

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Two diagrams are the same when they serialise to the same JSON. */
function sameDiagram(left: Diagram, right: Diagram): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Replaces the diagram of the editor and resets the history. */
function applyDiagram(next: Diagram): void {
  if (sameDiagram(diagramStore.diagram, next)) {
    return;
  }
  diagramStore.setDiagram(deepClone(next));
  lastEmitted = undefined;
}

/** Saves the diagram with the storage adapter of the host application. */
async function runSave(): Promise<void> {
  try {
    await saveStore.save();
    emit("save", deepClone(diagramStore.diagram));
  } catch (cause) {
    emit("error", toError(cause));
  }
}

/** Returns the SQL of the diagram. */
function exportSql(): string {
  return exportSQL(diagramStore.diagram);
}

/** Returns the DBML of the diagram. */
function exportDbml(): string {
  return exportDBML(diagramStore.diagram);
}

/** Replaces the diagram with the one the SQL describes. */
function importSql(
  sql: string,
  database: DatabaseType = diagramStore.diagram.database,
): Diagram {
  const imported = importSQL(sql, database);
  diagramStore.setDiagram(imported);
  lastEmitted = undefined;
  emit("import-sql", imported);
  return imported;
}

/** Runs a command that a plugin registered. */
function runCommand(key: string): boolean {
  const handler = pluginCommands.get(key);
  if (!handler) {
    return false;
  }
  handler();
  return true;
}

/** Builds the context a plugin receives when the editor activates it. */
function createPluginContext(): SDKPluginContext {
  const stores: Record<string, unknown> = {
    diagram: diagramStore,
    ui: uiStore,
    history: historyStore,
  };

  return {
    get diagram(): Diagram {
      return diagramStore.diagram;
    },
    metadata: metadataRegistry,
    registerExtension: <THandler>(extension: Parameters<PluginManager["registerExtension"]>[0]) => {
      pluginManager.registerExtension(extension as never);
    },
    getStore: <TStore>(storeId: string): TStore | undefined =>
      stores[storeId] as TStore | undefined,
    diagramStore,
    ui: uiStore,
    history: historyStore,
    registerSlot: (slotName: string, component: Component): void => {
      pluginSlots.value = { ...pluginSlots.value, [slotName]: component };
    },
    registerCommand: (key: string, handler: () => void): void => {
      pluginCommands.set(key, handler);
    },
    registerMetadata: (schema: MetadataSchema): void => {
      metadataRegistry.register(schema);
    },
  };
}

/** Registers and activates the plugins of the editor. */
async function activatePlugins(): Promise<void> {
  for (const plugin of props.plugins) {
    try {
      pluginManager.register(plugin as unknown as Plugin);
    } catch (cause) {
      emit("error", toError(cause));
    }
  }

  const result = await pluginManager.activateAll(createPluginContext());
  for (const failure of result.failed) {
    emit("error", toError(failure.error));
  }
}

/** Adds a table to the diagram. */
function addTable(): void {
  const table = createTable(
    uniqueTableName(diagramStore.tables),
    { x: 100 + diagramStore.tables.length * 260, y: 100 },
  );
  diagramStore.addTable(table);
  uiStore.selectTable(String(table.id));
}

/** Adds a note to the diagram. */
function addNote(): void {
  const note = createNote({ x: 100 + diagramStore.notes.length * 260, y: 100 });
  diagramStore.addEntity("notes", note);
  uiStore.selectNote(String(note.id));
}

/** Adds an area to the diagram. */
function addArea(): void {
  const area = createArea(
    uniqueTableName(diagramStore.areas, "area"),
    { x: 100 + diagramStore.areas.length * 260, y: 100 },
  );
  diagramStore.addEntity("areas", area);
  uiStore.selectArea(String(area.id));
}

/** Handles an entry of the menu of the header. */
function onMenu(key: string): void {
  switch (key) {
    case "file:save":
      void runSave();
      break;
    case "file:export-sql":
      emit("export-sql", exportSql());
      break;
    case "file:export-dbml":
      emit("export-dbml", exportDbml());
      break;
    case "edit:add-table":
      addTable();
      break;
    case "edit:add-note":
      addNote();
      break;
    case "edit:add-area":
      addArea();
      break;
    case "view:toggle-sidebar":
      uiStore.toggleSidebar();
      break;
    case "view:toggle-view-mode":
      uiStore.toggleViewMode();
      break;
    case "view:toggle-grid":
      uiStore.toggleGrid();
      break;
    case "view:zoom-in":
      uiStore.zoomIn();
      break;
    case "view:zoom-out":
      uiStore.zoomOut();
      break;
    case "view:reset-zoom":
      uiStore.resetView();
      break;
    default:
      break;
  }
}

/** The automatic saving. */
let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

function restartAutoSave(): void {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
  if (!props.autoSave || !props.storage) {
    return;
  }
  const interval = Math.max(1, props.autoSaveInterval);
  autoSaveTimer = setInterval(() => {
    void runSave();
  }, interval);
  // The timer must not keep a Node process alive when the editor is rendered
  // on the server. Browsers do not have `unref`, so the call is optional.
  (autoSaveTimer as unknown as { unref?: () => void }).unref?.();
}

// The diagram of the editor. The controlled mode wins over the initial value.
if (props.modelValue) {
  applyDiagram(props.modelValue);
} else if (props.initialValue) {
  applyDiagram(props.initialValue);
} else if (props.database) {
  diagramStore.updateDiagram({ database: props.database });
}

if (props.storage) {
  saveStore.configure(props.storage);
}

uiStore.setViewMode(props.viewMode);

if (props.metadataSchema) {
  metadataRegistry.register(props.metadataSchema);
}

for (const customType of props.customTypes) {
  if (!diagramStore.types.some((type) => type.name === customType.name)) {
    diagramStore.addEntity("types", customType);
  }
}

// A change of the diagram is reported to the host application.
watch(
  () => diagramStore.revision,
  () => {
    const snapshot = deepClone(diagramStore.diagram);
    if (props.modelValue !== undefined) {
      lastEmitted = snapshot;
      emit("update:modelValue", snapshot);
    }
    emit("change", snapshot, {
      type: "update",
      command: historyStore.undoDescription,
      at: new Date().toISOString(),
    });
  },
);

// The controlled mode follows the diagram of the host application.
watch(
  () => props.modelValue,
  (next) => {
    if (!next || next === lastEmitted) {
      return;
    }
    applyDiagram(next);
  },
);

// The database of the diagram follows the prop.
watch(
  () => props.database,
  (value) => {
    if (!value || value === diagramStore.diagram.database) {
      return;
    }
    diagramStore.updateDiagram({ database: value });
  },
);

// The view mode of the canvas follows the prop.
watch(
  () => props.viewMode,
  (value) => {
    if (!value || value === uiStore.viewMode) {
      return;
    }
    uiStore.setViewMode(value);
  },
);

// The custom types of the diagram follow the prop.
watch(
  () => props.customTypes,
  (value) => {
    for (const customType of value) {
      if (!diagramStore.types.some((type) => type.name === customType.name)) {
        diagramStore.addEntity("types", customType);
      }
    }
  },
  { deep: true },
);

// The storage adapter of the host application follows the prop.
watch(
  () => props.storage,
  (value) => {
    if (value) {
      saveStore.configure(value);
    }
    restartAutoSave();
  },
);

// The automatic saving follows the props.
watch(() => [props.autoSave, props.autoSaveInterval], restartAutoSave);

// The selection of the editor is reported to the host application.
watch(
  () => [
    uiStore.selectedTableIds,
    uiStore.selectedRelationshipIds,
    uiStore.selectedNoteIds,
    uiStore.selectedAreaIds,
    uiStore.selectedFields,
  ],
  () => {
    emit("select", {
      tables: [...uiStore.selectedTableIds],
      relationships: [...uiStore.selectedRelationshipIds],
      notes: [...uiStore.selectedNoteIds],
      areas: [...uiStore.selectedAreaIds],
      fields: uiStore.selectedFields.map((field) => ({ ...field })),
    });
  },
);

void activatePlugins();
restartAutoSave();

onBeforeUnmount(() => {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
  void pluginManager.deactivateAll();
});

defineExpose({
  save: runSave,
  exportSql,
  exportDbml,
  importSql,
  runCommand,
  getDiagram: (): Diagram => deepClone(diagramStore.diagram),
});
</script>

<template>
  <NConfigProvider
    :theme="theme"
    class="ddb-editor"
    data-testid="drawdb-editor"
  >
    <NGlobalStyle />
    <div class="ddb-editor__layout">
      <Header @save="runSave" @menu="onMenu" />
      <div class="ddb-editor__body">
        <SidePanel v-if="showSidePanel" class="ddb-editor__side-panel" />
        <div class="ddb-editor__canvas">
          <Canvas />
          <component
            v-for="(slot, name) in pluginSlots"
            :key="name"
            :is="slot"
            class="ddb-editor__plugin-slot"
          />
        </div>
      </div>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.ddb-editor {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.ddb-editor__layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ddb-editor__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.ddb-editor__side-panel {
  flex: 0 0 280px;
  overflow: auto;
}

.ddb-editor__canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.ddb-editor__plugin-slot {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
