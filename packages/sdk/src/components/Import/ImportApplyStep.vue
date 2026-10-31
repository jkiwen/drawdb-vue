<script setup lang="ts">
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { useUIStore } from "../../stores/ui.ts";
import styles from "./import.module.css";

// TODO(i18n): English until P8 task 8.
const wizard = useImportWizardStore();
const diagramStore = useDiagramStore();
const ui = useUIStore();

const added = computed(() => wizard.outcome?.tables ?? 0);
const entries = computed(() => {
  const sessions = diagramStore.diagram.imports ?? [];
  const last = sessions[sessions.length - 1];
  return last?.entries ?? [];
});

/** Centres the canvas on the first table the import brought in. */
function focusFirst(): void {
  const table = diagramStore.diagram.tables[0];
  if (table === undefined) return;
  ui.selectTable(String(table.id));
  ui.centerOn(table.x + 110, table.y + 25);
}

function close(): void {
  wizard.close();
}
</script>

<template>
  <section :class="styles.step" data-testid="import-step-apply">
    <div :class="styles.result" data-testid="import-result">
      <strong>{{ added }} table(s) are in the diagram.</strong>
      <span :class="styles.hint">The import is one step of the history: undo takes it back out.</span>
    </div>
    <div :class="styles.actions">
      <button type="button" :class="styles.button" data-testid="import-result-focus" @click="focusFirst">
        Show me
      </button>
      <button type="button" :class="styles.button" data-testid="import-result-close" @click="close">
        Done
      </button>
    </div>
    <ul v-if="entries.length > 0" :class="styles.audit" data-testid="import-audit-list">
      <li
        v-for="(entry, index) in entries"
        :key="index"
        :class="styles.issue"
        :data-level="entry.level"
        data-testid="import-audit-entry"
      >
        <span :class="styles.badge">{{ entry.level }}</span>
        <span :class="styles.code">{{ entry.code }}</span>
        <span :class="styles.path">{{ entry.path }}</span>
        <span :class="styles.message">{{ entry.message }}</span>
      </li>
    </ul>
    <p v-else :class="styles.hint" data-testid="import-audit-empty">
      The file was read without anything to report.
    </p>
  </section>
</template>
