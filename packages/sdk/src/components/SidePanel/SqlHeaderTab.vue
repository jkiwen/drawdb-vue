<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton, NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

/**
 * The SQL header tab: the text the exported SQL starts with.
 *
 * The SQL header is a property of the diagram, so the edit goes through the
 * diagram store and is undoable like every other change.
 */

const diagram = useDiagramStore();

const draft = ref(String(diagram.diagram.sqlHeader ?? ""));

watch(
  () => diagram.diagram.sqlHeader,
  (value) => {
    if (typeof value === "string") draft.value = value;
  },
);

function commit(): void {
  if (draft.value !== (diagram.diagram.sqlHeader ?? "")) {
    diagram.updateSqlHeader(draft.value);
  }
}
</script>

<template>
  <div class="sql-header-tab" data-testid="sqlheader-tab">
    <NInput
      type="textarea"
      :rows="12"
      data-testid="sql-header-input"
      :value="draft"
      @update:value="draft = $event"
      @blur="commit"
    />
    <NButton size="small" class="sql-header-tab__save" data-testid="sql-header-save" @click="commit">
      Save
    </NButton>
  </div>
</template>

<style scoped>
.sql-header-tab__save {
  margin-top: var(--ddb-space-3);
}
</style>
