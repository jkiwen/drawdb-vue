import { watch } from "vue";
import { deepClone } from "@drawdb/core";
import type {
  CustomType,
  DatabaseType,
  Diagram,
  MetadataSchema,
  StorageAdapter,
} from "@drawdb/core";
import type { DiagramStore } from "../stores/diagram.ts";
import type { HistoryStore } from "../stores/history.ts";
import type { SaveStore } from "../stores/save.ts";
import type { UIStore } from "../stores/ui.ts";
import { setLocale } from "../i18n/index.ts";
import type { EditorCommandsApi } from "./use-editor-commands.ts";
import type { EditorPluginsApi } from "./use-editor-plugins.ts";
import type {
  ChangeInfo,
  EditorSelection,
  ViewMode,
} from "../types/sdk-options.ts";

export interface EditorProps {
  modelValue?: Diagram;
  initialValue?: Diagram;
  database?: DatabaseType;
  viewMode?: ViewMode;
  locale: string;
  customTypes: CustomType[];
  /** A metadata schema the editor registers. */
  metadataSchema?: MetadataSchema;
  storage?: StorageAdapter;
  autoSave: boolean;
  autoSaveInterval: number;
}

export interface EditorSyncOptions {
  props: EditorProps;
  diagramStore: DiagramStore;
  uiStore: UIStore;
  historyStore: HistoryStore;
  saveStore: SaveStore;
  commands: EditorCommandsApi;
  plugins: EditorPluginsApi;
  /** Reports the diagram to the host application. */
  onUpdateModelValue: (diagram: Diagram) => void;
  /** Reports a change of the diagram to the host application. */
  onChange: (diagram: Diagram, info: ChangeInfo) => void;
  /** Reports the selection to the host application. */
  onSelect: (selection: EditorSelection) => void;
}

export interface EditorSyncApi {
  /** Replaces the diagram of the editor and resets the history. */
  applyDiagram(next: Diagram): void;
  /** Called after an import, so that the editor forgets the last echo. */
  onImported(): void;
}

/**
 * Keeps the editor and the props of the host application in sync.
 *
 * The composable applies the props when the editor starts and follows them
 * afterwards: the controlled mode, the database, the view mode, the custom
 * types, the storage adapter, the automatic saving, the locale and the
 * selection.
 */
export function useEditorSync(options: EditorSyncOptions): EditorSyncApi {
  const { props, diagramStore, uiStore, historyStore, saveStore } = options;

  /** The diagram the editor emitted last, so that its echo is ignored. */
  let lastEmitted: Diagram | undefined;

  /** Two diagrams are the same when they serialise to the same JSON. */
  function sameDiagram(left: Diagram, right: Diagram): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function applyDiagram(next: Diagram): void {
    if (sameDiagram(diagramStore.diagram, next)) {
      return;
    }
    diagramStore.setDiagram(deepClone(next));
    lastEmitted = undefined;
  }

  function onImported(): void {
    lastEmitted = undefined;
  }

  // The diagram of the editor. The controlled mode wins over the initial one.
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

  uiStore.setViewMode(props.viewMode ?? "physical");

  if (props.metadataSchema) {
    options.plugins.registerMetadata(props.metadataSchema);
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
        options.onUpdateModelValue(snapshot);
      }
      options.onChange(snapshot, {
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
      options.commands.configureAutoSave(props.autoSave, props.autoSaveInterval);
    },
  );

  // The automatic saving follows the props.
  watch(
    () => [props.autoSave, props.autoSaveInterval],
    () =>
      options.commands.configureAutoSave(
        props.autoSave,
        props.autoSaveInterval,
      ),
  );

  // The labels of the editor follow the locale of the host application.
  watch(
    () => props.locale,
    (value) => {
      setLocale(value);
    },
  );

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
      options.onSelect({
        tables: [...uiStore.selectedTableIds],
        relationships: [...uiStore.selectedRelationshipIds],
        notes: [...uiStore.selectedNoteIds],
        areas: [...uiStore.selectedAreaIds],
        fields: uiStore.selectedFields.map(
          (field: { tableId: string; fieldId: string }) => ({ ...field }),
        ),
      });
    },
  );

  return { applyDiagram, onImported };
}
