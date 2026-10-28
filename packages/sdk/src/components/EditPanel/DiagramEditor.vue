<script setup lang="ts">
import { ref, watch } from "vue";
import type { Diagram } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";

/**
 * The diagram group of the edit panel: what the panel shows when nothing
 * is selected (design section 4.1). It edits the title of the diagram and
 * and the database is read-only here because switching the
 * dialect is a documented operation of the data layer (spec section 6.4),
 * not a property field.
 */
const props = defineProps<{ diagram: Diagram }>();

const store = useDiagramStore();

const title = ref(props.diagram.title ?? "");
watch(
  () => props.diagram.title,
  (value) => {
    title.value = value ?? "";
  },
);


function commit(): void {
  const next = title.value.trim();
  if (next === (props.diagram.title ?? "")) return;
  store.updateDiagram({ title: next === "" ? undefined : next });
}
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="diagram-editor">
    <label>
      <span :class="styles.label">{{ t("edit_panel_diagram_title") }}</span>
      <input
        v-model="title"
        :class="styles.input"
        data-testid="diagram-title"
        @blur="commit"
        @keydown.enter="commit"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_diagram_database") }}</span>
      <input
        :value="props.diagram.database"
        :class="styles.input"
        disabled
        data-testid="diagram-database"
      />
    </label>
    <p :class="styles.label" style="grid-column: 1 / -1; margin: 0">
      {{ t("edit_panel_diagram_hint") }}
    </p>
  </div>
</template>
