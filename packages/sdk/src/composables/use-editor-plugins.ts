import { ref, type Ref } from "vue";
import type { Component } from "vue";
import { MetadataRegistry, PluginManager } from "@drawdb/core";
import type {
  Diagram,
  MetadataSchema,
  Plugin,
} from "@drawdb/core";
import type { DiagramStore } from "../stores/diagram.ts";
import type { HistoryStore } from "../stores/history.ts";
import type { UIStore } from "../stores/ui.ts";
import type { SDKPlugin, SDKPluginContext } from "../types/sdk-options.ts";

export interface EditorPluginsOptions {
  /** The plugins of the editor. */
  plugins: () => SDKPlugin[];
  diagramStore: DiagramStore;
  uiStore: UIStore;
  historyStore: HistoryStore;
  /** Reports a failure to the host application. */
  onError: (error: Error) => void;
}

export interface EditorPluginsApi {
  /** The components the plugins contributed. */
  pluginSlots: Ref<Record<string, Component>>;
  /** Registers a metadata schema. */
  registerMetadata(schema: MetadataSchema): void;
  /** Runs a command that a plugin registered. */
  runCommand(key: string): boolean;
  /** Registers and activates the plugins of the editor. */
  activate(): Promise<void>;
  /** Deactivates the plugins of the editor. */
  deactivate(): Promise<void>;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * The life cycle of the plugins of the editor.
 *
 * The composable owns the plugin manager, the metadata registry and the slots
 * the plugins contribute their components to.
 */
export function useEditorPlugins(options: EditorPluginsOptions): EditorPluginsApi {
  const pluginManager = new PluginManager();
  const metadataRegistry = new MetadataRegistry();
  const pluginSlots = ref<Record<string, Component>>({});
  const pluginCommands = new Map<string, () => void>();

  function registerMetadata(schema: MetadataSchema): void {
    metadataRegistry.register(schema);
  }

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
      diagram: options.diagramStore,
      ui: options.uiStore,
      history: options.historyStore,
    };

    return {
      get diagram(): Diagram {
        return options.diagramStore.diagram;
      },
      metadata: metadataRegistry,
      registerExtension: (
        extension: Parameters<PluginManager["registerExtension"]>[0],
      ) => {
        pluginManager.registerExtension(extension as never);
      },
      getStore: <TStore>(storeId: string): TStore | undefined =>
        stores[storeId] as TStore | undefined,
      diagramStore: options.diagramStore,
      ui: options.uiStore,
      history: options.historyStore,
      registerSlot: (slotName: string, component: Component): void => {
        pluginSlots.value = { ...pluginSlots.value, [slotName]: component };
      },
      registerCommand: (key: string, handler: () => void): void => {
        pluginCommands.set(key, handler);
      },
      registerMetadata,
    };
  }

  async function activate(): Promise<void> {
    for (const plugin of options.plugins()) {
      try {
        pluginManager.register(plugin as unknown as Plugin);
      } catch (cause) {
        options.onError(toError(cause));
      }
    }

    const result = await pluginManager.activateAll(createPluginContext());
    for (const failure of result.failed) {
      options.onError(toError(failure.error));
    }
  }

  async function deactivate(): Promise<void> {
    await pluginManager.deactivateAll();
  }

  return {
    pluginSlots,
    registerMetadata,
    runCommand,
    activate,
    deactivate,
  };
}
