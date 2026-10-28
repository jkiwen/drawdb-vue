<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import { useHistoryStore } from "../../stores/history.ts";
import classes from "./BottomPanel.module.css";

/**
 * The history tab of the bottom panel: the commands of the undo stack,
 * newest first, with the current position marked. Commands that were
 * undone are listed below the marker (design section 8.1: the tab is
 * sourced from the undo stack but keeps the undone records).
 *
 * TODO: make an entry clickable to undo/redo to that position once the
 * CommandManager of the core grows a jump API; for now the list is
 * read-only.
 */

interface HistoryEntry {
  key: string;
  description: string;
  /** Whether the command is currently applied (false = undone). */
  applied: boolean;
}

const history = useHistoryStore();

const entries = computed<HistoryEntry[]>(() => {
  // The reactive mirrors change with every undo, redo and execute, so the
  // snapshot they guard is always fresh.
  void history.depth;
  void history.canUndo;
  void history.canRedo;
  const snapshot = history.snapshot();
  const items: HistoryEntry[] = [];
  for (let i = snapshot.undoStack.length - 1; i >= 0; i -= 1) {
    items.push({
      key: `undo-${i}`,
      description: snapshot.undoStack[i].description ?? t("history_command_fallback"),
      applied: true,
    });
  }
  for (let i = snapshot.redoStack.length - 1; i >= 0; i -= 1) {
    items.push({
      key: `redo-${i}`,
      description: snapshot.redoStack[i].description ?? t("history_command_fallback"),
      applied: false,
    });
  }
  return items;
});

/** The position of the current-state marker: after the applied entries. */
const currentIndex = computed(() => {
  void history.depth;
  void history.canRedo;
  return history.snapshot().undoStack.length;
});
</script>

<template>
  <div :class="classes.tabBody" data-testid="history-tab">
    <ol v-if="entries.length > 0" :class="classes.historyList" data-testid="history-list">
      <template v-for="(entry, index) in entries" :key="entry.key">
        <li
          v-if="index === currentIndex"
          :class="classes.historyCurrent"
          data-testid="history-current"
        >
          {{ t("history_current_marker") }}
        </li>
        <li
          :class="[classes.historyEntry, !entry.applied && classes.historyUndone]"
          :data-testid="'history-entry'"
          :data-applied="entry.applied"
        >
          {{ entry.description }}
        </li>
      </template>
      <li
        v-if="entries.length === currentIndex"
        :class="classes.historyCurrent"
        data-testid="history-current"
      >
        {{ t("history_current_marker") }}
      </li>
    </ol>
    <p v-else :class="classes.empty" data-testid="history-empty">
      {{ t("history_empty") }}
    </p>
  </div>
</template>
