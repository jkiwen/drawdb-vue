import type { Diagram, StorageAdapter } from "@drawdb/core";
import { useSaveStore, type SaveState } from "../stores/save.ts";
import { resolvePinia } from "./pinia.ts";

export interface StorageApi {
  /** The state of the last save operation. */
  state: SaveState;
  /** True when the diagram has unsaved changes. */
  dirty: boolean;
  /** The id of the diagram in the store, if it was saved before. */
  currentId: string | undefined;
  /** The last error of a save operation. */
  error: string | undefined;
  /** Injects the adapter the editor stores its diagrams in. */
  configure(adapter: StorageAdapter): void;
  /** The adapter currently in use. */
  adapter(): StorageAdapter | undefined;
  saveDiagram(): Promise<void>;
  loadDiagram(id: string): Promise<Diagram | undefined>;
  removeDiagram(id: string): Promise<void>;
  listDiagrams(): Promise<Diagram[]>;
  listDiagramIds(): Promise<string[]>;
}

/**
 * Binds the editor to a storage adapter.
 *
 * The adapter is injected by the host application, so the SDK does not assume
 * anything about where the diagrams live.
 */
export function useStorage(): StorageApi {
  const pinia = resolvePinia();
  const save = useSaveStore(pinia);

  function configure(adapter: StorageAdapter): void {
    save.configure(adapter);
  }

  function adapter(): StorageAdapter | undefined {
    return save.adapter;
  }

  return {
    get state() {
      return save.state;
    },
    get dirty() {
      return save.dirty;
    },
    get currentId() {
      return save.currentId;
    },
    get error() {
      return save.error;
    },
    configure,
    adapter,
    saveDiagram: () => save.save(),
    loadDiagram: (id: string) => save.load(id),
    removeDiagram: (id: string) => save.remove(id),
    listDiagrams: () => save.list(),
    listDiagramIds: () => save.listIds(),
  };
}
