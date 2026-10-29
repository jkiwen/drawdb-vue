<script setup lang="ts">
import { computed } from "vue";
import { NSelect } from "naive-ui";
import type { Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import "./relationship-dialog.css";

/**
 * The picker of one end of a relationship.
 *
 * The end is a table and a field of that table. When the user picks a table
 * without a field, the end is the table alone and the canvas links it to the
 * primary key of the table.
 */
const props = withDefaults(
  defineProps<{
    /** The tables the user can pick from. */
    tables: Table[];
    /** The id of the table the end is on. */
    tableId: string | number | null;
    /** The id of the field the end is on, empty when the end is the table. */
    fieldId: string | number | null;
    /** The label of the table picker. */
    label: string;
    /** The prefix of the test ids of the pickers. */
    testid: string;
  }>(),
  { tableId: null, fieldId: null },
);

const emit = defineEmits<{
  "update:tableId": [value: string | number | null];
  "update:fieldId": [value: string | number | null];
}>();

const tableOptions = computed(() =>
  props.tables.map((table) => ({
    label: table.name,
    value: table.id,
  })),
);

const selectedTable = computed(() =>
  props.tables.find((table) => String(table.id) === String(props.tableId)),
);

const fieldOptions = computed(() =>
  (selectedTable.value?.fields ?? []).map((field) => ({
    label: field.name,
    value: field.id,
  })),
);

/** The primary key of the selected table, the field a table alone points at. */
const primaryKeyId = computed(
  () => selectedTable.value?.primaryKey?.columns[0]?.fieldId,
);

function onTableChange(value: string | number | null): void {
  emit("update:tableId", value);
  // The field of the previous table does not belong to the new one.
  emit("update:fieldId", null);
}

function onFieldChange(value: string | number | null): void {
  emit("update:fieldId", value);
}
</script>

<template>
  <div class="ddb-relationship-end">
    <label class="ddb-relationship-end__label" :for="`${testid}-table`">
      {{ label }} {{ t("table").toLowerCase() }}
    </label>
    <NSelect
      :id="`${testid}-table`"
      :value="tableId"
      :options="tableOptions"
      :data-testid="`${testid}-table`"
      :placeholder="t('relationship_pick_table')"
      @update:value="onTableChange"
    />
    <label class="ddb-relationship-end__label" :for="`${testid}-field`">
      {{ label }} {{ t("field").toLowerCase() }}
    </label>
    <NSelect
      :id="`${testid}-field`"
      :value="fieldId"
      :options="fieldOptions"
      :data-testid="`${testid}-field`"
      :disabled="fieldOptions.length === 0"
      :placeholder="
        primaryKeyId === undefined
          ? t('relationship_no_field')
          : t('relationship_primary_key')
      "
      @update:value="onFieldChange"
    />
  </div>
</template>
