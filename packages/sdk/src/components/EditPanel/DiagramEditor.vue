<script setup lang="ts">
import { ref, watch } from "vue";
import type { DatabaseType, Diagram } from "@drawdb/core";
import { DATABASE_OPTIONS } from "../../utils/database-options.ts";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";

/**
 * The diagram group of the edit panel: what the panel shows when nothing
 * is selected (design section 4.1).
 *
 * The dialect is a property of the diagram and the reader edits it here; the
 * data layer still decides what a switch means for the types it holds
 * (spec section 6.4), and the hint under the fields says so.
 */
const props = defineProps<{ diagram: Diagram }>();

const store = useDiagramStore();

const title = ref(props.diagram.title ?? "");
const description = ref(props.diagram.description ?? "");
watch(
  () => props.diagram.title,
  (value) => {
    title.value = value ?? "";
  },
);
watch(
  () => props.diagram.description,
  (value) => {
    description.value = value ?? "";
  },
);

function commitTitle(): void {
  const next = title.value.trim();
  if (next === (props.diagram.title ?? "")) return;
  store.updateDiagram({ title: next === "" ? undefined : next });
}

function commitDescription(): void {
  const next = description.value.trim();
  if (next === (props.diagram.description ?? "")) return;
  store.updateDiagram({ description: next === "" ? undefined : next });
}

function commitDatabase(event: Event): void {
  const value = (event.target as HTMLSelectElement | null)?.value as DatabaseType | undefined;
  if (value === undefined || value === props.diagram.database) return;
  store.updateDiagram({ database: value });
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
        @blur="commitTitle"
        @keydown.enter="commitTitle"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_diagram_database") }}</span>
      <select
        :value="props.diagram.database"
        :class="styles.input"
        data-testid="diagram-database"
        @change="commitDatabase"
      >
        <option v-for="option in DATABASE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label style="grid-column: 1 / -1">
      <span :class="styles.label">{{ t("edit_panel_description") }}</span>
      <textarea
        v-model="description"
        :class="styles.input"
        rows="3"
        maxlength="500"
        data-testid="diagram-description"
        @change="commitDescription"
        @blur="commitDescription"
      />
    </label>
    <p :class="styles.label" style="grid-column: 1 / -1; margin: 0">
      {{ t("edit_panel_diagram_hint") }}
    </p>
  </div>
</template>
