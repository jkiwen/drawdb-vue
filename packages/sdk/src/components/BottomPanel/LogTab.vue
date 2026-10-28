<script setup lang="ts">
import { computed, ref } from "vue";
import type { Command } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useHistoryStore } from "../../stores/history.ts";
import classes from "./log-tab.module.css";

/**
 * The log tab of the bottom panel (design section 8.1).
 *
 * The tab mirrors the command stack of the history store as read-only text
 * lines, newest first, and keeps the undone commands in the list like the
 * history tab does. The list is capped at 1000 entries; "Clear" only hides
 * the entries the panel already shows and never touches the undo stack,
 * so later commands appear again.
 */
defineOptions({ name: "DrawDBBottomPanelLogTab" });

/** The number of entries the log keeps (design section 8.3). */
const MAX_LOG_ENTRIES = 1000;

const history = useHistoryStore();

/** The commands the user cleared from the panel; the stack keeps them. */
const cleared = ref<Set<Command>>(new Set());

interface LogEntry {
  key: number;
  text: string;
}

/** The description of a command; a command may not carry one. */
function describe(command: Command): string {
  return command.description ?? t("history_command_fallback");
}

const entries = computed<LogEntry[]>(() => {
  // The reactive mirrors of the store change with every mutation, so the
  // snapshot they guard is fresh whenever a command arrives.
  void history.depth;
  void history.canUndo;
  void history.canRedo;
  const snapshot = history.snapshot();
  const commands = [
    ...snapshot.undoStack.slice().reverse(),
    ...snapshot.redoStack.slice().reverse(),
  ].filter((command) => !cleared.value.has(command));
  return commands.slice(0, MAX_LOG_ENTRIES).map((command, index) => ({
    key: index,
    text: describe(command),
  }));
});

/** Hides the entries the panel shows now; the undo stack is untouched. */
function clear(): void {
  const snapshot = history.snapshot();
  cleared.value = new Set([...snapshot.undoStack, ...snapshot.redoStack]);
}
</script>

<template>
  <div :class="classes.tabBody" data-testid="log-tab">
    <div :class="classes.toolbar">
      <button
        type="button"
        :class="classes.action"
        :disabled="entries.length === 0"
        data-testid="log-clear"
        @click="clear"
      >
        {{ t("clear") }}
      </button>
    </div>
    <ul v-if="entries.length > 0" :class="classes.list" data-testid="log-list">
      <li
        v-for="entry in entries"
        :key="entry.key"
        :class="classes.entry"
        data-testid="log-entry"
      >
        {{ entry.text }}
      </li>
    </ul>
    <p v-else :class="classes.empty" data-testid="log-empty">
      {{ t("bottom_log_empty") }}
    </p>
  </div>
</template>
