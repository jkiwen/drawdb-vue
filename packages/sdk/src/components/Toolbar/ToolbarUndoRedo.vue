<script setup lang="ts">
/**
 * Undo and redo (design 6.7): the tooltip carries the description of the
 * command a click would undo or redo; with an empty stack the button is grey
 * and says why.
 */
import { computed } from "vue";
import { useHistoryStore } from "../../stores/history.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const history = useHistoryStore();

// TODO(i18n Task 7): the titles move into the locale files.
const undoTitle = computed(() =>
  history.canUndo && history.undoDescription
    ? `Undo: ${history.undoDescription} (Ctrl+Z)`
    : "Nothing to undo (Ctrl+Z)",
);
const redoTitle = computed(() =>
  history.canRedo && history.redoDescription
    ? `Redo: ${history.redoDescription} (Ctrl+Y)`
    : "Nothing to redo (Ctrl+Y)",
);
</script>

<template>
  <div :class="classes.group" role="group" aria-label="History">
    <ToolbarButton
      icon="undo"
      :title="undoTitle"
      testid="toolbar-undo"
      :disabled="!history.canUndo"
      @click="history.undo()"
    />
    <ToolbarButton
      icon="redo"
      :title="redoTitle"
      testid="toolbar-redo"
      :disabled="!history.canRedo"
      @click="history.redo()"
    />
  </div>
</template>
