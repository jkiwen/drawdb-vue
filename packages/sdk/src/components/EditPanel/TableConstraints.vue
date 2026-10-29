<script setup lang="ts">
import { computed } from "vue";
import type { FieldId, Relationship, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import ForeignKeysPanel from "./ForeignKeysPanel.vue";
import KeyCard from "./KeyCard.vue";
import UniqueKeysPanel from "./UniqueKeysPanel.vue";

/**
 * The constraints group of the edit panel: the primary key (it has no name of
 * its own), the unique keys and the foreign keys. Every key is a card
 * (review of 2026-10-29): a closed card summarises the key, an open one edits
 * it the way the fields group edits the columns of the table.
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

const primarySummary = computed(() => {
  const names = primaryFields.value.map((field) => field.name);
  return names.length > 0 ? `(${names.join(", ")})` : t("edit_panel_constraints_empty");
});

/** The fields a constraint could still gain. */
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
    <KeyCard testid="constraint-primary" badge="PK" title-testid="constraint-name-primary" :title="PRIMARY_NAME" :summary="primarySummary">
      <div
        v-for="field in primaryFields"
        :key="String(field.id)"
        :class="styles['constraint-row']"
        data-testid="constraint-field-primary"
      >
        <span :class="styles['constraint-fields']">{{ field.name }}</span>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          data-testid="constraint-remove-field-primary"
          @click="togglePrimary(field.id, false)"
        >×</button>
      </div>
      <label v-if="freeFields(primaryFields.map((field) => field.id)).length > 0" :class="styles.field">
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
    </KeyCard>

    <UniqueKeysPanel :table="props.table" />
    <ForeignKeysPanel
      :table="props.table"
      :tables="props.tables"
      :relationships="props.relationships"
    />
  </div>
</template>
