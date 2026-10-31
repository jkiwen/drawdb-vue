<script setup lang="ts">
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { t } from "../../i18n/index.ts";
import { useUIStore } from "../../stores/ui.ts";
import styles from "./import.module.css";

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
      <strong>{{ t("wizard_result_added", { count: added }) }}</strong>
      <span :class="styles.hint">{{ t("wizard_result_undo") }}</span>
    </div>
    <div :class="styles.actions">
      <button type="button" :class="styles.button" data-testid="import-result-focus" @click="focusFirst">
        {{ t("wizard_show_me") }}
      </button>
      <button type="button" :class="styles.button" data-testid="import-result-close" @click="close">
        {{ t("wizard_done") }}
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
      {{ t("wizard_audit_clean") }}
    </p>
  </section>
</template>
