<script setup lang="ts">
import { computed } from "vue";
import type { Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import { tableIndexes } from "./edit-panel-groups.ts";

/**
 * The indexes group of the edit panel (design section 7). Read-only for
 * now: the index editor of phase P2' owns the editing, including the
 * column picker and the index-level undo (spec section 3.8.3).
 */
const props = defineProps<{ table: Table }>();

const rows = computed(() => tableIndexes(props.table));
</script>

<template>
  <div :class="styles.rows" data-testid="table-indexes">
    <p v-if="rows.length === 0" :class="styles.label" data-testid="indexes-empty">
      {{ t("edit_panel_indexes_empty") }}
    </p>
    <div
      v-for="row in rows"
      :key="row.id"
      :class="styles['constraint-row']"
      data-testid="index-row"
    >
      <span :class="[styles.badge, row.unique ? styles['badge-warn'] : styles['badge-info']]">
        {{ row.unique ? t("edit_panel_constraint_unique") : "INDEX" }}
      </span>
      <span :class="styles['constraint-name']">{{ row.name }}</span>
      <span :class="styles['constraint-fields']">
        {{ row.fields.join(", ") || t("edit_panel_index_columns", { count: 0 }) }}
      </span>
    </div>
  </div>
</template>
