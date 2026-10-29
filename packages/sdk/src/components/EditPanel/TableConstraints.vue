<script setup lang="ts">
import { computed } from "vue";
import type { FieldId, Relationship, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import ForeignKeysPanel from "./ForeignKeysPanel.vue";
import UniqueKeysPanel from "./UniqueKeysPanel.vue";

/**
 * The constraints group of the edit panel: the primary key (inline, it has no
 * name of its own), the unique keys and the foreign keys (each in its own
 * panel, because a key is created by naming it first — review of 2026-10-29).
 */
const props = defineProps<{
  table: Table;
  tables: readonly Table[];
  relationships: readonly Relationship[];
}>();

const diagram = useDiagramStore();

const PRIMARY_NAME = "PRIMARY";

const primaryFields = computed(() =>
  props.table.fields.filter((field) => field.primary === true),
);

/** The fields a constraint could still gain, by role. */
function freeFields(taken: readonly FieldId[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function togglePrimary(fieldId: FieldId, on: boolean): void {
  diagram.updateField(props.table.id, fieldId, { primary: on });
}
</script>

<template>
  <div :class="styles.rows" data-testid="table-constraints">
    <section :class="styles['constraint-block']" data-testid="constraint-primary">
      <header :class="styles['constraint-head']">
        <span :class="[styles.badge, styles['badge-info']]">{{ t("primary_key") }}</span>
        <span :class="styles['constraint-name']" data-testid="constraint-name-primary">
          {{ PRIMARY_NAME }}
        </span>
      </header>
      <p v-if="primaryFields.length === 0" :class="styles.label" data-testid="constraints-empty">
        {{ t("edit_panel_constraints_empty") }}
      </p>
      <div
        v-for="field in primaryFields"
        :key="String(field.id)"
        :class="styles['constraint-row']"
        data-testid="constraint-field-primary"
      >
        <span :class="styles['constraint-fields']">{{ field.name }}</span>
        <button
          type="button"
          :class="styles['icon-button']"
          :title="t('delete')"
          data-testid="constraint-remove-field-primary"
          @click="togglePrimary(field.id, false)"
        >×</button>
      </div>
      <label v-if="freeFields(primaryFields.map((field) => field.id)).length > 0" :class="styles.row">
        <select
          :class="styles.select"
          data-testid="constraint-add-field-primary"
          @change="(event) => {
            const value = (event.target as HTMLSelectElement).value;
            if (value !== '') togglePrimary(value, true);
            (event.target as HTMLSelectElement).value = '';
          }"
        >
          <option value="">{{ t("add_field") }}</option>
          <option
            v-for="field in freeFields(primaryFields.map((item) => item.id))"
            :key="String(field.id)"
            :value="String(field.id)"
          >{{ field.name }}</option>
        </select>
      </label>
    </section>

    <UniqueKeysPanel :table="props.table" />
    <ForeignKeysPanel
      :table="props.table"
      :tables="props.tables"
      :relationships="props.relationships"
    />
  </div>
</template>
