<script setup lang="ts">
import { NButton, NSpace } from "naive-ui";
import { useHistoryStore } from "../../stores/history.ts";

/**
 * The undo and redo buttons of the editor.
 *
 * The buttons are disabled when there is nothing to undo or to redo, and they
 * carry the description of the command they would apply.
 */
const history = useHistoryStore();
</script>

<template>
  <NSpace :size="4" align="center" data-testid="undo-redo">
    <NButton
      data-testid="undo-btn"
      size="small"
      quaternary
      class="undo-redo__button"
      :disabled="!history.canUndo"
      :title="history.undoDescription ?? 'Undo'"
      @click="history.undo()"
    >
      Undo
    </NButton>
    <NButton
      data-testid="redo-btn"
      size="small"
      quaternary
      class="undo-redo__button"
      :disabled="!history.canRedo"
      :title="history.redoDescription ?? 'Redo'"
      @click="history.redo()"
    >
      Redo
    </NButton>
  </NSpace>
</template>

<style scoped>
.undo-redo__button {
  font-size: var(--ddb-text-body);
  font-weight: 500;
  border-radius: var(--ddb-radius-md);
  transition:
    background-color var(--ddb-duration-fast) var(--ddb-easing),
    color var(--ddb-duration-fast) var(--ddb-easing);
}
</style>
