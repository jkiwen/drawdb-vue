<script setup lang="ts">
import { computed, ref } from "vue";
import { createId, keyColumns } from "@drawdb/core";
import type { FieldId, Index, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { suggestedKeyName } from "../../stores/key-actions.ts";
import styles from "./edit-panel.module.css";
import KeyCard from "./KeyCard.vue";

/**
 * The indexes of the selected table.
 *
 * An index is a key object as well (design section 3.8.3): it carries its own
 * name, its ordered columns and one step of the undo stack per edit.
 */
const props = defineProps<{ table: Table }>();

const diagram = useDiagramStore();

const indexes = computed<Index[]>(() => props.table.indices ?? []);

const creating = ref(false);
const draftName = ref("");
const draftUnique = ref(false);

const fieldName = (id: FieldId): string =>
  props.table.fields.find((field) => String(field.id) === String(id))?.name ?? String(id);

function columnsOf(item: Index) {
  return keyColumns(item);
}

function summaryOf(item: Index): string {
  const columns = columnsOf(item).map((column) => fieldName(column.fieldId)).join(", ");
  if (columns === "") return item.unique ? t("unique") : "";
  return `(${columns})${item.unique ? ` ${t("unique")}` : ""}`;
}

function freeFields(taken: readonly FieldId[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function openCreate(): void {
  draftName.value = suggestedKeyName("index", props.table);
  draftUnique.value = false;
  creating.value = true;
}

function cancelCreate(): void {
  creating.value = false;
}

function confirmCreate(): void {
  const name = draftName.value.trim() || suggestedKeyName("index", props.table);
  diagram.addIndex(props.table.id, {
    id: createId(),
    name,
    logicalName: name,
    unique: draftUnique.value,
    columns: [],
  });
  creating.value = false;
}

function rename(index: number, name: string): void {
  const item = indexes.value[index];
  if (!item) return;
  diagram.renameIndex(props.table.id, String(item.id), { name });
}

function renameLogical(index: number, logicalName: string): void {
  const item = indexes.value[index];
  if (!item) return;
  diagram.renameIndex(props.table.id, String(item.id), { name: item.name, logicalName });
}

function setUnique(index: number, unique: boolean): void {
  const item = indexes.value[index];
  if (!item) return;
  diagram.updateTable(props.table.id, {
    indices: indexes.value.map((entry, at) => (at === index ? { ...entry, unique } : entry)),
  });
}

function remove(index: number): void {
  const item = indexes.value[index];
  if (!item) return;
  diagram.removeIndex(props.table.id, String(item.id));
}

function addField(index: number, fieldId: string): void {
  const item = indexes.value[index];
  if (!item || fieldId === "") return;
  diagram.setIndexColumns(props.table.id, String(item.id), [...columnsOf(item), { fieldId }]);
}

function removeField(index: number, at: number): void {
  const item = indexes.value[index];
  if (!item) return;
  diagram.setIndexColumns(
    props.table.id,
    String(item.id),
    columnsOf(item).filter((_, position) => position !== at),
  );
}

function moveField(index: number, at: number, delta: -1 | 1): void {
  const item = indexes.value[index];
  if (!item) return;
  const columns = [...columnsOf(item)];
  const to = at + delta;
  if (to < 0 || to >= columns.length) return;
  const [moved] = columns.splice(at, 1);
  columns.splice(to, 0, moved!);
  diagram.setIndexColumns(props.table.id, String(item.id), columns);
}
</script>

<template>
  <div :class="styles.rows" data-testid="table-indexes">
    <header :class="styles['constraint-head']">
      <span :class="[styles.badge, styles['badge-info']]">{{ t("index") }}</span>
      <button
        v-if="!creating"
        type="button"
        :class="styles['link-button']"
        data-testid="index-create-open"
        @click="openCreate"
      >{{ t("add") }}</button>
    </header>

    <div v-if="creating" :class="styles['create-form']" data-testid="index-create">

      <label :class="styles.field">
        <span :class="styles.label">{{ t("name") }}</span>
        <input
          v-model="draftName"
          :class="styles.input"
          data-testid="index-create-name"
          @keyup.enter="confirmCreate"
        />
      </label>
      <label :class="[styles.field, styles['field-inline']]">
        <input v-model="draftUnique" type="checkbox" :class="styles.check" data-testid="index-create-unique" />
        <span :class="styles.label">{{ t("unique") }}</span>
      </label>
      <div :class="styles['form-actions']">
        <button
          type="button"
          :class="styles['link-button']"
          data-testid="index-create-confirm"
          @click="confirmCreate"
        >{{ t("create") }}</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          data-testid="index-create-cancel"
          @click="cancelCreate"
        >{{ t("cancel") }}</button>
      </div>
    </div>

    <p v-if="indexes.length === 0 && !creating" :class="styles.label" data-testid="indexes-empty">
      {{ t("edit_panel_indexes_empty") }}
    </p>

    <KeyCard
      v-for="(item, index) in indexes"
      :key="String(item.id ?? index)"
      :testid="`index-${index}`"
      badge="INDEX"
      :title="item.name"
      :summary="summaryOf(item)"
    >
      <template #actions>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          :data-testid="`index-remove-${index}`"
          @click="remove(index)"
        >×</button>
      </template>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_key_physical_name") }}</span>
        <input
          :class="styles.input"
          :value="item.name"
          :aria-label="t('index')"
          :data-testid="`index-name-${index}`"
          @change="(event) => rename(index, (event.target as HTMLInputElement).value)"
        />
      </label>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_key_logical_name") }}</span>
        <input
          :class="styles.input"
          :value="item.logicalName ?? item.name"
          :data-testid="`index-logical-name-${index}`"
          @change="(event) => renameLogical(index, (event.target as HTMLInputElement).value)"
        />
      </label>
      <label :class="[styles.field, styles['field-inline']]">
        <input
          type="checkbox"
          :class="styles.check"
          :checked="item.unique"
          :data-testid="`index-unique-${index}`"
          @change="setUnique(index, ($event.target as HTMLInputElement).checked)"
        />
        <span :class="styles.label">{{ t("unique") }}</span>
      </label>
      <div
        v-for="(column, at) in columnsOf(item)"
        :key="`${String(column.fieldId)}-${at}`"
        :class="styles['constraint-row']"
        data-testid="index-field"
      >
        <span :class="styles['constraint-fields']">{{ fieldName(column.fieldId) }}</span>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          title="↑"
          :data-testid="`index-field-up-${index}-${at}`"
          @click="moveField(index, at, -1)"
        >↑</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          title="↓"
          :data-testid="`index-field-down-${index}-${at}`"
          @click="moveField(index, at, 1)"
        >↓</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          :data-testid="`index-remove-field-${index}-${at}`"
          @click="removeField(index, at)"
        >×</button>
      </div>
      <select
        v-if="freeFields(columnsOf(item).map((column) => column.fieldId)).length > 0"
        :class="styles.select"
        :data-testid="`index-add-field-${index}`"
        @change="(event) => addField(index, (event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t("add_field") }}</option>
        <option
          v-for="field in freeFields(columnsOf(item).map((column) => column.fieldId))"
          :key="String(field.id)"
          :value="String(field.id)"
        >{{ field.name }}</option>
      </select>
    </KeyCard>
  </div>
</template>
