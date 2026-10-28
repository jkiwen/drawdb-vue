<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { appearanceValues } from "./edit-panel-groups.ts";

/**
 * The appearance group of the edit panel (design section 4.3): the colour,
 * the lock and whether the fields show on the canvas. It works on one
 * table and on a multi selection — the batch goes through the atomic
 * command of the store (Q12) and a disagreement shows as a placeholder.
 */
const props = defineProps<{ tables: Table[] }>();

const store = useDiagramStore();

const values = computed(() => appearanceValues(props.tables));
const MULTIPLE = "edit_panel_multiple_values";
const COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const color = ref(values.value.color);
watch(values, (next) => {
  color.value = next.color;
});

function commitColor(): void {
  const next = color.value.trim();
  // An empty field means "no colour"; anything that is not a hex value would
  // reach the canvas as a background the browser cannot parse, so it is
  // dropped instead of stored.
  if (next !== "" && !COLOR_PATTERN.test(next)) return;
  if (values.value.colorMultiple || next !== (values.value.color ?? "")) {
    apply({ color: next });
  }
}

function commitLocked(event: Event): void {
  apply({ locked: (event.target as HTMLInputElement).checked });
}

function commitDetails(event: Event): void {
  apply({ details: (event.target as HTMLInputElement).checked });
}

function apply(patch: { color?: string; locked?: boolean; details?: boolean }): void {
  // An emptied colour field clears the colour rather than storing an empty
  // string, so a later read cannot tell "no colour" from "colour ''".
  const next = patch.color === "" ? { ...patch, color: undefined } : patch;
  if (props.tables.length > 1) {
    store.applyTableBatch(props.tables, next);
    return;
  }
  const table = props.tables[0];
  if (!table) return;
  store.updateTable(table.id, next);
}
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="table-appearance">
    <label>
      <span :class="styles.label">{{ t("edit_panel_appearance_color") }}</span>
      <input
        v-model="color"
        :class="styles.input"
        :placeholder="values.colorMultiple ? t(MULTIPLE) : '#rrggbb'"
        data-testid="appearance-color"
        @change="commitColor"
      />
    </label>
    <div :class="styles['check-column']">
      <label :class="styles.check">
        <input
          type="checkbox"
          :checked="values.locked"
          :indeterminate="values.lockedMultiple"
          data-testid="appearance-locked"
          @change="commitLocked"
        />
        <span>{{ t("edit_panel_appearance_locked") }}</span>
      </label>
      <label :class="styles.check">
        <input
          type="checkbox"
          :checked="values.details"
          :indeterminate="values.detailsMultiple"
          data-testid="appearance-details"
          @change="commitDetails"
        />
        <span>{{ t("edit_panel_appearance_details") }}</span>
      </label>
    </div>
  </div>
</template>
