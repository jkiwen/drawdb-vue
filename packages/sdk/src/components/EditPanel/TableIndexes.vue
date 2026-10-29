<script setup lang="ts">
import { computed, ref } from "vue";
import { createId } from "@drawdb/core";
import type { FieldId, Index, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { nextIndexName } from "./constraint-forms.ts";
import styles from "./edit-panel.module.css";

/**
 * The indexes of the selected table (review of 2026-10-29): an index is
 * created by naming it, then takes several columns that can be ordered,
 * removed and marked unique. The write goes through `updateTable`, so the
 * whole list lands on the undo stack as one step.
 */
const props = defineProps<{ table: Table }>();

const diagram = useDiagramStore();

const indexes = computed<Index[]>(() => props.table.indices ?? []);

const creating = ref(false);
const draftName = ref("");
const draftUnique = ref(false);

const fieldName = (id: FieldId): string =>
  props.table.fields.find((field) => String(field.id) === String(id))?.name ?? String(id);

function freeFields(taken: readonly FieldId[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function write(next: Index[]): void {
  diagram.updateTable(props.table.id, { indices: next });
}

function openCreate(): void {
  draftName.value = nextIndexName(props.table);
  draftUnique.value = false;
  creating.value = true;
}

function cancelCreate(): void {
  creating.value = false;
}

function confirmCreate(): void {
  const name = draftName.value.trim() || nextIndexName(props.table);
  write([...indexes.value, { id: createId(), name, unique: draftUnique.value, fields: [] }]);
  creating.value = false;
}

function rename(index: number, name: string): void {
  write(indexes.value.map((item, at) => (at === index ? { ...item, name } : item)));
}

function setUnique(index: number, unique: boolean): void {
  write(indexes.value.map((item, at) => (at === index ? { ...item, unique } : item)));
}

function remove(index: number): void {
  write(indexes.value.filter((_, at) => at !== index));
}

function addField(index: number, fieldId: string): void {
  if (fieldId === "") return;
  write(
    indexes.value.map((item, at) =>
      at === index ? { ...item, fields: [...item.fields, fieldId] } : item,
    ),
  );
}

function removeField(index: number, at: number): void {
  write(
    indexes.value.map((item, position) =>
      position === index ? { ...item, fields: item.fields.filter((_, i) => i !== at) } : item,
    ),
  );
}

function moveField(index: number, at: number, delta: -1 | 1): void {
  const item = indexes.value[index];
  if (!item) return;
  const to = at + delta;
  if (to < 0 || to >= item.fields.length) return;
  const fields = [...item.fields];
  const [moved] = fields.splice(at, 1);
  fields.splice(to, 0, moved!);
  write(indexes.value.map((entry, position) => (position === index ? { ...entry, fields } : entry)));
}
</script>

<template>
  <div :class="styles.rows" data-testid="table-indexes">
    <header :class="styles['constraint-head']">
      <span :class="[styles.badge, styles['badge-info']]">{{ t("index") }}</span>
      <button
        v-if="!creating"
        type="button"
        :class="styles['add-button']"
        data-testid="index-create-open"
        @click="openCreate"
      >＋ {{ t("add") }}</button>
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
          :class="styles['add-button']"
          data-testid="index-create-confirm"
          @click="confirmCreate"
        >{{ t("create") }}</button>
        <button
          type="button"
          :class="styles['icon-button']"
          data-testid="index-create-cancel"
          @click="cancelCreate"
        >{{ t("cancel") }}</button>
      </div>
    </div>

    <p v-if="indexes.length === 0 && !creating" :class="styles.label" data-testid="indexes-empty">
      {{ t("edit_panel_indexes_empty") }}
    </p>

    <div
      v-for="(item, index) in indexes"
      :key="String(item.id ?? index)"
      :class="styles['constraint-block']"
      data-testid="index-row"
    >
      <div :class="styles['constraint-head']">
        <input
          :class="styles.input"
          :value="item.name"
          :aria-label="t('index')"
          :data-testid="`index-name-${index}`"
          @change="(event) => rename(index, (event.target as HTMLInputElement).value)"
        />
        <label :class="styles['field-inline']">
          <input
            type="checkbox"
            :class="styles.check"
            :checked="item.unique"
            :data-testid="`index-unique-${index}`"
            @change="setUnique(index, ($event.target as HTMLInputElement).checked)"
          />
          <span :class="styles.label">{{ t("unique") }}</span>
        </label>
        <button
          type="button"
          :class="styles['icon-button']"
          :title="t('delete')"
          :data-testid="`index-remove-${index}`"
          @click="remove(index)"
        >×</button>
      </div>
      <div
        v-for="(fieldId, at) in item.fields"
        :key="`${String(fieldId)}-${at}`"
        :class="styles['constraint-row']"
        data-testid="index-field"
      >
        <span :class="styles['constraint-fields']">{{ fieldName(fieldId) }}</span>
        <button
          type="button"
          :class="styles['icon-button']"
          title="↑"
          :data-testid="`index-field-up-${index}-${at}`"
          @click="moveField(index, at, -1)"
        >↑</button>
        <button
          type="button"
          :class="styles['icon-button']"
          title="↓"
          :data-testid="`index-field-down-${index}-${at}`"
          @click="moveField(index, at, 1)"
        >↓</button>
        <button
          type="button"
          :class="styles['icon-button']"
          :title="t('delete')"
          :data-testid="`index-remove-field-${index}-${at}`"
          @click="removeField(index, at)"
        >×</button>
      </div>
      <select
        v-if="freeFields(item.fields).length > 0"
        :class="styles.select"
        :data-testid="`index-add-field-${index}`"
        @change="(event) => addField(index, (event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t("add_field") }}</option>
        <option
          v-for="field in freeFields(item.fields)"
          :key="String(field.id)"
          :value="String(field.id)"
        >{{ field.name }}</option>
      </select>
    </div>
  </div>
</template>
