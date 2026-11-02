import { CommandManager } from "@drawdb/core";
import type { Command } from "@drawdb/core";
import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Undo/redo history for the diagram editor.
 *
 * The core `CommandManager` is a plain class, so the store keeps reactive
 * mirrors of its state and synchronises them after every mutation.
 */
export const useHistoryStore = defineStore("history", () => {
  const manager = new CommandManager();

  const canUndo = ref(false);
  const canRedo = ref(false);
  const undoDescription = ref<string | undefined>(undefined);
  const redoDescription = ref<string | undefined>(undefined);
  const depth = ref(0);

  function sync(): void {
    canUndo.value = manager.canUndo;
    canRedo.value = manager.canRedo;
    undoDescription.value = manager.undoDescription;
    redoDescription.value = manager.redoDescription;
    depth.value = manager.snapshot().undoStack.length;
  }

  function execute(command: Command): void {
    manager.execute(command);
    sync();
  }

  function undo(): boolean {
    const undone = manager.undo();
    sync();
    return undone;
  }

  function redo(): boolean {
    const redone = manager.redo();
    sync();
    return redone;
  }

  function clear(): void {
    manager.clear();
    sync();
  }

  /**
   * Moves the history to a position: `depth` commands applied (the history
   * tab clicks a row). Undo and redo run one by one, so the side effects of
   * every command land the way they do on a single undo.
   */
  function jumpTo(target: number): boolean {
    const moved = manager.jumpTo(target);
    sync();
    return moved;
  }

  function snapshot() {
    return manager.snapshot();
  }

  return {
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    depth,
    execute,
    undo,
    redo,
    jumpTo,
    clear,
    snapshot,
  };
});

export type HistoryStore = ReturnType<typeof useHistoryStore>;
