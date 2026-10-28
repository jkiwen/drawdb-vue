<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import type { PropType } from "vue";
import { NConfigProvider, NGlobalStyle, darkTheme, lightTheme } from "naive-ui";
import { setActivePinia } from "pinia";
import { deepClone, validateDiagram } from "@drawdb/core";
import type {
  CustomType,
  DatabaseType,
  Diagram,
  DiagramIssue,
  MetadataSchema,
  StorageAdapter,
} from "@drawdb/core";
import EditorLayout from "./EditorLayout.vue";
import "../styles/tokens.css";
import { useEditorCommands } from "../composables/use-editor-commands.ts";
import { useEditorPlugins } from "../composables/use-editor-plugins.ts";
import { useEditorSync } from "../composables/use-editor-sync.ts";
import { usePanelHotkeys } from "../composables/use-panel-hotkeys.ts";
import { resolvePinia } from "../composables/pinia.ts";
import { setLocale } from "../i18n/index.ts";
import { useDialogStore } from "../stores/dialogs.ts";
import { useDiagramStore } from "../stores/diagram.ts";
import { useHistoryStore } from "../stores/history.ts";
import { useSaveStore } from "../stores/save.ts";
import { useUIStore } from "../stores/ui.ts";
import type {
  ChangeInfo,
  EditorSelection,
  EditorTheme,
  SDKPlugin,
  ViewMode,
} from "../types/sdk-options.ts";

/**
 * The editor of the SDK.
 *
 * The component glues the header, the canvas and the side panel together. It
 * owns the controlled and the uncontrolled mode of the diagram, the automatic
 * saving, the plugin life cycle and the events the host application listens
 * to. The work itself happens in the composables of the editor and in the
 * components of the layout.
 */
defineOptions({ name: "DrawDBEditor" });

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
  metadataSchema: {
    type: Object as PropType<MetadataSchema>,
    default: undefined,
  },
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
  (event: "export-json", json: string): void;
  (event: "import-sql", diagram: Diagram): void;
  (event: "error", error: Error): void;
  (event: "select", selection: EditorSelection): void;
  /**
   * Reports a menu entry the editor does not handle.
   *
   * The host application owns the entries that need its own pages, such as
   * opening a file or reading the documentation.
   */
  (event: "menu", key: string): void;
}>();

// The stores need an active pinia. The SDK falls back to its own instance so
// that the editor also works outside of an application.
setActivePinia(resolvePinia());

// The labels of the editor follow the locale of the host application.
setLocale(props.locale);

const diagramStore = useDiagramStore();
const uiStore = useUIStore();
const historyStore = useHistoryStore();
const saveStore = useSaveStore();
const dialogs = useDialogStore();

const theme = computed(() => (props.theme === "dark" ? darkTheme : lightTheme));
const showSidePanel = computed(() => !props.readonly && uiStore.sidebarOpen);

const plugins = useEditorPlugins({
  plugins: () => props.plugins,
  diagramStore,
  uiStore,
  historyStore,
  onError: (error) => emit("error", error),
});

const commands = useEditorCommands({
  diagramStore,
  uiStore,
  saveStore,
  onSave: (diagram) => emit("save", diagram),
  onExportSql: (sql) => emit("export-sql", sql),
  onExportDbml: (dbml) => emit("export-dbml", dbml),
  onExportJson: (json) => emit("export-json", json),
  onImportSql: (diagram) => emit("import-sql", diagram),
  onError: (error) => emit("error", error),
  onImported: () => {
    sync.onImported();
  },
  onOpenDialog: (name, options) => dialogs.open(name, options),
});

// The editor follows the props of the host application.
const sync = useEditorSync({
  props,
  diagramStore,
  uiStore,
  historyStore,
  saveStore,
  commands,
  plugins,
  onUpdateModelValue: (diagram) => emit("update:modelValue", diagram),
  onChange: (diagram, info) => emit("change", diagram, info),
  onSelect: (selection) => emit("select", selection),
});

void plugins.activate();
commands.configureAutoSave(props.autoSave, props.autoSaveInterval);

// The layout panel hotkeys (mod+b / mod+alt+b / mod+`) answer as long as the
// editor is mounted.
const stopPanelHotkeys = usePanelHotkeys();

/**
 * Handles an entry of the menu of the header.
 *
 * The entries the editor does not know are handed over to the host
 * application, which owns the pages they need.
 */
function onMenu(key: string): void {
  if (!commands.onMenu(key)) {
    emit("menu", key);
  }
}

onBeforeUnmount(() => {
  commands.stopAutoSave();
  stopPanelHotkeys();
  void plugins.deactivate();
});

defineExpose({
  save: commands.runSave,
  exportSql: commands.exportSql,
  exportDbml: commands.exportDbml,
  exportJson: commands.exportJson,
  importSql: commands.importSql,
  runCommand: plugins.runCommand,
  getDiagram: (): Diagram => deepClone(diagramStore.diagram),
  /** Arranges the tables of the diagram. */
  autoArrange: (): void => diagramStore.autoArrange(),
  /** Validates the diagram and returns the issues it has. */
  validate: (): DiagramIssue[] => validateDiagram(diagramStore.diagram),
  /** Opens the tab that lists the issues of the diagram. */
  openIssuesTab: (): void => uiStore.setActiveTab("issues"),
});
</script>

<template>
  <NConfigProvider
    :theme="theme"
    class="ddb-editor"
    data-testid="drawdb-editor"
  >
    <NGlobalStyle />
    <EditorLayout
      :plugin-slots="plugins.pluginSlots.value"
      :show-side-panel="showSidePanel"
      :custom-types="customTypes"
      :database="diagramStore.diagram.database"
      @save="commands.runSave"
      @menu="onMenu"
    />
  </NConfigProvider>
</template>

<style scoped>
.ddb-editor {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
