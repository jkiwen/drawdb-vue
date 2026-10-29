<script setup lang="ts">
import { computed } from "vue";
import type { DatabaseType, FieldId, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { buildFieldRows, fieldOverview } from "./edit-panel-model.ts";
import {
  addFieldPair,
  commitLogicalFamily,
  commitLogicalName,
  commitPhysicalName,
  commitPhysicalType,
  removeFieldPair,
} from "./edit-actions.ts";
import FieldPairRow from "./FieldPairRow.vue";

/**
 * The field grid of a single selected table (design section 4.2): the
 * overview bar and one paired row per field — logical attribute and
 * physical column side by side. Adding and removing a field always
 * touches both layers at once. The table-level names and descriptions
 * live in TableBasics, one group above.
 */
const props = defineProps<{
  table: Table;
  database: DatabaseType;
  logicalView: boolean;
  focusFieldId?: FieldId;
}>();

const store = useDiagramStore();

const rows = computed(() => buildFieldRows(props.table, props.database));
const overview = computed(() => fieldOverview(rows.value));

function onRemove(row: (typeof rows.value)[number]): void {
  removeFieldPair(store, props.table, row);
}

/** Adds or drops one column of the primary key of the table. */
function onCommitPrimary(fieldId: FieldId, on: boolean): void {
  const primary = props.table.primaryKey;
  const current = (primary?.columns ?? []).map((column) => column.fieldId);
  const next = on
    ? [...current, fieldId]
    : current.filter((id) => String(id) !== String(fieldId));
  store.setPrimaryColumns(
    props.table.id,
    next.map((id) => ({ fieldId: id })),
    primary?.name ?? "PRIMARY",
  );
}
</script>

<template>
  <div data-testid="table-editor">
    <div :class="styles.overview" data-testid="field-overview">
      {{ overview.text }}
    </div>
    <div :class="styles.scroll" data-testid="field-grid">
      <div :class="styles.rows" data-testid="field-rows">
        <FieldPairRow
          v-for="row in rows"
          :key="row.key"
          :table="props.table"
          :row="row"
          :database="props.database"
          :logical-view="props.logicalView"
          :focused="row.field?.id !== undefined && String(row.field.id) === String(props.focusFieldId)"
          @commit-logical-name="(id, value) => commitLogicalName(store, props.table, id, value)"
          @commit-logical-family="(id, family) => commitLogicalFamily(store, props.table, id, family)"
          @commit-physical-name="(id, value) => commitPhysicalName(store, props.table, id, value)"
          @commit-physical-type="(id, spec) => commitPhysicalType(store, props.table, id, spec)"
          @commit-primary="onCommitPrimary"
          @remove="onRemove(row)"
        />
      </div>
    </div>
    <div style="padding: 6px 0">
      <button
        type="button"
        :class="styles['link-button']"
        data-testid="add-field"
        @click="addFieldPair(store, props.table)"
      >
        + {{ t("edit_panel_add_field") }}
      </button>
    </div>
  </div>
</template>
