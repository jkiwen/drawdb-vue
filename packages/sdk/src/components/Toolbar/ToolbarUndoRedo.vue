<script setup lang="ts">
/**
 * Undo and redo (design 6.7): the tooltip carries the description of the
 * command a click would undo or redo; with an empty stack the button is grey
 * and says why.
 */
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import { useHistoryStore } from "../../stores/history.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const history = useHistoryStore();

const undoTitle = computed(() =>
  history.canUndo && history.undoDescription
    ? t("history_undo", { description: history.undoDescription })
    : t("history_undo_none"),
);
const redoTitle = computed(() =>
  history.canRedo && history.redoDescription
    ? t("history_redo", { description: history.redoDescription })
    : t("history_redo_none"),
);
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('history_group')">
    <ToolbarButton
      icon="undo"
      :title="undoTitle"
      testid="undo-btn"
      :disabled="!history.canUndo"
      @click="history.undo()"
    />
    <ToolbarButton
      icon="redo"
      :title="redoTitle"
      testid="redo-btn"
      :disabled="!history.canRedo"
      @click="history.redo()"
    />
  </div>
</template>
