<script setup lang="ts">
import { computed } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import { tableConstraints } from "./edit-panel-groups.ts";

/**
 * The constraints group of the edit panel (design section 7): the primary
 * key, the unique constraints and the foreign keys of the selected table.
 * Read-only for now — the double-named constraint objects are phase P2'
 * (spec section 3.8.3), and the entries region of that phase owns their
 * editing.
 */
const props = defineProps<{
  table: Table;
  relationships: readonly Relationship[];
}>();

const rows = computed(() =>
  tableConstraints(props.table, props.relationships),
);

const KIND_KEYS: Record<string, string> = {
  primary: "edit_panel_constraint_primary",
  unique: "edit_panel_constraint_unique",
  foreign: "edit_panel_constraint_foreign",
};
</script>

<template>
  <div :class="styles.rows" data-testid="table-constraints">
    <p v-if="rows.length === 0" :class="styles.label" data-testid="constraints-empty">
      {{ t("edit_panel_constraints_empty") }}
    </p>
    <div
      v-for="row in rows"
      :key="row.id"
      :class="styles['constraint-row']"
      data-testid="constraint-row"
    >
      <span :class="[styles.badge, styles['badge-info']]">
        {{ t(KIND_KEYS[row.kind] ?? row.kind) }}
      </span>
      <span
        v-if="row.kind !== 'primary'"
        :class="styles['constraint-name']"
      >{{ row.name }}</span>
      <span :class="styles['constraint-fields']">{{ row.fields.join(", ") }}</span>
    </div>
  </div>
</template>
