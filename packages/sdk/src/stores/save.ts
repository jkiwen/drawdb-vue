import { createId, deepClone } from "@drawdb/core";
import type { Diagram, StorageAdapter } from "@drawdb/core";
import { defineStore } from "pinia";
import { ref, shallowRef, watch } from "vue";
import { useDiagramStore } from "./diagram.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Persistence state of the current diagram.
 *
 * The store owns the `StorageAdapter` used by the editor. The adapter is
 * injected by the host application, which keeps the SDK free of assumptions
 * about where diagrams are stored.
 */
export const useSaveStore = defineStore("save", () => {
  const diagramStore = useDiagramStore();

  const adapter = shallowRef<StorageAdapter | undefined>(undefined);
  const state = ref<SaveState>("idle");
  const error = ref<string | undefined>(undefined);
  const lastSavedAt = ref<string | undefined>(undefined);
  const dirty = ref(false);
  const currentId = ref<string | undefined>(undefined);

  // A synchronous watcher keeps the dirty flag accurate even when a change
  // and the following save happen in the same tick.
  watch(
    () => diagramStore.revision,
    () => {
      dirty.value = true;
      if (state.value === "saved") {
        state.value = "idle";
      }
    },
    { flush: "sync" },
  );

  function configure(next: StorageAdapter): void {
    adapter.value = next;
  }

  function requireAdapter(): StorageAdapter {
    if (!adapter.value) {
      throw new Error(
        "No storage adapter configured. Call useSaveStore().configure(adapter) first.",
      );
    }
    return adapter.value;
  }

  async function save(): Promise<void> {
    const storage = requireAdapter();
    const diagram = diagramStore.diagram;

    if (!diagram.id) {
      diagram.id = createId();
    }
    currentId.value = diagram.id;

    state.value = "saving";
    error.value = undefined;

    try {
      // The diagram of the store is a reactive proxy. The adapters get a
      // plain copy, because a proxy cannot be serialised.
      await storage.save(deepClone(diagram));
      dirty.value = false;
      state.value = "saved";
      lastSavedAt.value = new Date().toISOString();
    } catch (cause) {
      state.value = "error";
      error.value = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    }
  }

  async function load(id: string): Promise<Diagram | undefined> {
    const storage = requireAdapter();
    state.value = "saving";
    error.value = undefined;

    try {
      const diagram = await storage.load(id);
      if (diagram) {
        diagramStore.setDiagram(diagram);
        currentId.value = diagram.id ?? id;
      }
      dirty.value = false;
      state.value = "saved";
      lastSavedAt.value = new Date().toISOString();
      return diagram;
    } catch (cause) {
      state.value = "error";
      error.value = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    }
  }

  async function remove(id: string): Promise<void> {
    const storage = requireAdapter();
    await storage.delete(id);

    if (currentId.value === id) {
      currentId.value = undefined;
      dirty.value = false;
    }
  }

  async function list(): Promise<Diagram[]> {
    return requireAdapter().list();
  }

  async function listIds(): Promise<string[]> {
    return requireAdapter().listIds();
  }

  return {
    adapter,
    state,
    error,
    lastSavedAt,
    dirty,
    currentId,
    configure,
    save,
    load,
    remove,
    list,
    listIds,
  };
});

export type SaveStore = ReturnType<typeof useSaveStore>;
