<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
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
import TypeSystemDialog from "./TypeSystem/TypeSystemDialog.vue";
import PrintPreviewDialog from "./Print/PrintPreviewDialog.vue";
import ImportWizard from "./Import/ImportWizard.vue";
import "../styles/tokens.css";
import { useEditorCommands } from "../composables/use-editor-commands.ts";
import { useEditorPlugins } from "../composables/use-editor-plugins.ts";
import { useEditorSync } from "../composables/use-editor-sync.ts";
import { usePanelHotkeys } from "../composables/use-panel-hotkeys.ts";
import { resolvePinia } from "../composables/pinia.ts";
import { setLocale } from "../i18n/index.ts";
import { useDialogStore } from "../stores/dialogs.ts";
import { useImportWizardStore } from "../stores/import-wizard.ts";
import { useDiagramStore } from "../stores/diagram.ts";
import { useHistoryStore } from "../stores/history.ts";
import { useSaveStore } from "../stores/save.ts";
import { useUIStore } from "../stores/ui.ts";
import type {
  ChangeInfo,
  EditorChromeOptions,
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
  /** Which parts of the editor chrome are shown (Q13). */
  chrome: { type: Object as PropType<EditorChromeOptions>, default: undefined },
  /**
   * Whether the host claims the "config:open" menu entry. When it is passed
   * the editor forwards the entry through the `menu` event instead of
   * opening the data type system itself.
   */
  onOpenDsm: { type: Function as PropType<() => void>, default: undefined },
});

const typeSystemOpen = ref(false);

/** Whether the print preview is open (ruling Q8). */
const printOpen = ref(false);

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
// Ruling Q21: hiding the left panel is the collapse of the layout panel, so
// the panel stays mounted here and keeps the state of the outline tree.
const showSidePanel = computed(() => !props.readonly);

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

// The import of P8 owns the three file keys: the wizard reads the file, shows
// what it found and asks where it goes before anything touches the diagram.
const importWizard = useImportWizardStore();
const IMPORT_KEYS: Record<string, "sql" | "dbml" | "json" | "erwin"> = {
  "file:import": "sql",
  "file:import-sql": "sql",
  "file:import-dbml": "dbml",
  "file:import-json": "json",
  "file:import-erwin": "erwin",
};

/**
 * Handles an entry of the menu of the header.
 *
 * The entries the editor does not know are handed over to the host
 * application, which owns the pages they need.
 */
function onMenu(key: string): void {
  // The configuration group opens the data type system of the editor when the
  // host has not claimed the entry: a host that wants its own page passes
  // `onOpenDsm` and gets the event instead (ruling Q16).
  if (key === "config:open" && !props.onOpenDsm) {
    typeSystemOpen.value = true;
    return;
  }
  const importFormat = IMPORT_KEYS[key];
  if (importFormat !== undefined) {
    importWizard.begin(importFormat);
    return;
  }
  // Printing is the sheet of the diagram, which the SDK can paginate itself
  // (ruling Q8): the preview opens here unless the host claimed the key.
  if (key === "file:print-preview" || key === "file:print") {
    printOpen.value = true;
    return;
  }
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
      :chrome="chrome"
      @save="commands.runSave"
      @menu="onMenu"
    />
    <TypeSystemDialog :open="typeSystemOpen" @close="typeSystemOpen = false" />
    <PrintPreviewDialog v-model:open="printOpen" :tables="diagramStore.diagram.tables" />
    <ImportWizard />
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
