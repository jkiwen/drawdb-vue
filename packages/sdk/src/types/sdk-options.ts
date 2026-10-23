import type { Component } from "vue";
import type {
  CustomType,
  DatabaseType,
  Diagram,
  MetadataSchema,
  Plugin,
  PluginContext,
  StorageAdapter,
} from "@drawdb/core";
import type { DiagramStore } from "../stores/diagram.ts";
import type { UIStore } from "../stores/ui.ts";
import type { HistoryStore } from "../stores/history.ts";

/** How the diagram is drawn: as it is stored, or only the logical relations. */
export type ViewMode = "physical" | "logical";

/** The theme of the editor. */
export type EditorTheme = "light" | "dark";

/** What changed in the diagram. */
export interface ChangeInfo {
  /** The kind of the change: `update`, `add`, `remove`, `undo`, `redo` or `reset`. */
  type: string;
  /** The description of the command that caused the change, when there was one. */
  command?: string;
  /** The moment of the change, as an ISO string. */
  at: string;
}

/**
 * The context a plugin receives when the editor activates it.
 *
 * It extends the framework agnostic context of the core with the stores of the
 * SDK, so that a plugin can change the diagram and read the state of the
 * editor.
 */
export interface SDKPluginContext extends PluginContext {
  /** The store that owns the diagram. */
  readonly diagramStore: DiagramStore;
  /** The store that owns the selection and the viewport. */
  readonly ui: UIStore;
  /** The store that owns the undo and the redo. */
  readonly history: HistoryStore;
  /** Contribute a component that the editor renders. */
  registerSlot(slotName: string, component: Component): void;
  /** Contribute a command that the host application can trigger. */
  registerCommand(key: string, handler: () => void): void;
  /** Contribute a metadata schema. */
  registerMetadata(schema: MetadataSchema): void;
}

/** A plugin of the Vue SDK. */
export interface SDKPlugin extends Omit<Plugin, "activate"> {
  /** Called once when the editor activates the plugin. */
  activate(context: SDKPluginContext): void | Promise<void>;
}

/** What the user selected in the editor. */
export interface EditorSelection {
  /** The ids of the selected tables. */
  tables: string[];
  /** The ids of the selected relationships. */
  relationships: string[];
  /** The ids of the selected notes. */
  notes: string[];
  /** The ids of the selected areas. */
  areas: string[];
  /** The selected fields, with the table they belong to. */
  fields: Array<{ tableId: string; fieldId: string }>;
}

/** The options of the `DrawDBEditor` component. */
export interface DrawDBEditorOptions {
  /** The diagram of the editor. The component is controlled while it is set. */
  modelValue?: Diagram;
  /** The diagram the editor starts with. It is only read once. */
  initialValue?: Diagram;
  /** The database the diagram is written for. */
  database?: DatabaseType;
  /** How the diagram is drawn. */
  viewMode?: ViewMode;
  /** Whether the diagram can be changed. */
  readonly?: boolean;
  /** The language of the user interface. */
  locale?: string;
  /** The theme of the editor. */
  theme?: EditorTheme;
  /** The plugins the editor activates. */
  plugins?: SDKPlugin[];
  /** A metadata schema the editor registers. */
  metadataSchema?: MetadataSchema;
  /** Custom types the diagram uses. */
  customTypes?: CustomType[];
  /** Where the diagrams are stored. */
  storage?: StorageAdapter;
  /** Whether the editor saves the diagram by itself. */
  autoSave?: boolean;
  /** The delay between two automatic saves, in milliseconds. */
  autoSaveInterval?: number;
}
