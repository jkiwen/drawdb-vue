<script setup lang="ts">
import { computed, ref } from "vue";
import { createId, keyColumns } from "@drawdb/core";
import type { FieldId, Table, UniqueKey } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { suggestedKeyName } from "../../stores/key-actions.ts";
import styles from "./edit-panel.module.css";
import KeyCard from "./KeyCard.vue";

/**
 * The unique keys of the selected table.
 *
 * A key is an object of its own (design section 3.8.3): it has a name, an
 * ordered list of columns and its own step on the undo stack, so creating,
 * renaming, ordering and removing are all one command each.
 */
const props = defineProps<{ table: Table }>();

const diagram = useDiagramStore();

const keys = computed<UniqueKey[]>(() => props.table.uniqueKeys ?? []);

const creating = ref(false);
const draftName = ref("");

const fieldName = (id: FieldId): string =>
  props.table.fields.find((field) => String(field.id) === String(id))?.name ?? String(id);

function columnsOf(key: UniqueKey) {
  return keyColumns(key);
}

function summaryOf(key: UniqueKey): string {
  const columns = columnsOf(key).map((column) => fieldName(column.fieldId));
  return columns.length > 0 ? `(${columns.join(", ")})` : "";
}

function freeFields(taken: readonly FieldId[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function openCreate(): void {
  draftName.value = suggestedKeyName("unique", props.table);
  creating.value = true;
}

function cancelCreate(): void {
  creating.value = false;
}

function confirmCreate(): void {
  const name = draftName.value.trim() || suggestedKeyName("unique", props.table);
  diagram.addUniqueKey(props.table.id, {
    id: createId(),
    name,
    logicalName: name,
    columns: [],
  });
  creating.value = false;
}

function rename(index: number, name: string): void {
  const key = keys.value[index];
  if (!key) return;
  diagram.renameUniqueKey(props.table.id, String(key.id), { name });
}

function renameLogical(index: number, logicalName: string): void {
  const key = keys.value[index];
  if (!key) return;
  diagram.renameUniqueKey(props.table.id, String(key.id), { name: key.name, logicalName });
}

function remove(index: number): void {
  const key = keys.value[index];
  if (!key) return;
  diagram.removeUniqueKey(props.table.id, String(key.id));
}

function addField(index: number, fieldId: string): void {
  const key = keys.value[index];
  if (!key || fieldId === "") return;
  diagram.setUniqueColumns(props.table.id, String(key.id), [...columnsOf(key), { fieldId }]);
}

function removeField(index: number, at: number): void {
  const key = keys.value[index];
  if (!key) return;
  diagram.setUniqueColumns(
    props.table.id,
    String(key.id),
    columnsOf(key).filter((_, position) => position !== at),
  );
}

function moveField(index: number, at: number, delta: -1 | 1): void {
  const key = keys.value[index];
  if (!key) return;
  const columns = [...columnsOf(key)];
  const to = at + delta;
  if (to < 0 || to >= columns.length) return;
  const [moved] = columns.splice(at, 1);
  columns.splice(to, 0, moved!);
  diagram.setUniqueColumns(props.table.id, String(key.id), columns);
}
</script>

<template>
  <div :class="styles.rows" data-testid="table-unique-keys">
    <header :class="styles['constraint-head']">
      <span :class="[styles.badge, styles['badge-info']]">{{ t("unique_constraints") }}</span>
      <button
        v-if="!creating"
        type="button"
        :class="styles['link-button']"
        data-testid="constraint-add-unique"
        @click="openCreate"
      >{{ t("add") }}</button>
    </header>

    <div v-if="creating" :class="styles['create-form']" data-testid="unique-create">

      <label :class="styles.field">
        <span :class="styles.label">{{ t("name") }}</span>
        <input
          v-model="draftName"
          :class="styles.input"
          data-testid="unique-create-name"
          @keyup.enter="confirmCreate"
        />
      </label>
      <div :class="styles['form-actions']">
        <button
          type="button"
          :class="styles['link-button']"
          data-testid="unique-create-confirm"
          @click="confirmCreate"
        >{{ t("create") }}</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          data-testid="unique-create-cancel"
          @click="cancelCreate"
        >{{ t("cancel") }}</button>
      </div>
    </div>

    <p v-if="keys.length === 0 && !creating" :class="styles.label" data-testid="unique-keys-empty">
      {{ t("edit_panel_constraints_empty") }}
    </p>

    <KeyCard
      v-for="(key, index) in keys"
      :key="String(key.id ?? index)"
      :testid="`constraint-unique-${index}`"
      badge="UK"
      :title="key.name"
      :summary="summaryOf(key)"
    >
      <template #actions>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          :data-testid="`constraint-remove-unique-${index}`"
          @click="remove(index)"
        >×</button>
      </template>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_key_physical_name") }}</span>
        <input
          :class="styles.input"
          :value="key.name"
          :aria-label="t('unique_constraints')"
          :data-testid="`constraint-name-unique-${index}`"
          @change="(event) => rename(index, (event.target as HTMLInputElement).value)"
        />
      </label>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_key_logical_name") }}</span>
        <input
          :class="styles.input"
          :value="key.logicalName ?? key.name"
          :data-testid="`constraint-logical-name-unique-${index}`"
          @change="(event) => renameLogical(index, (event.target as HTMLInputElement).value)"
        />
      </label>
      <div
        v-for="(column, at) in columnsOf(key)"
        :key="`${String(column.fieldId)}-${at}`"
        :class="styles['constraint-row']"
        data-testid="constraint-unique-field"
      >
        <span :class="styles['constraint-fields']">{{ fieldName(column.fieldId) }}</span>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          title="↑"
          :data-testid="`constraint-field-up-${index}-${at}`"
          @click="moveField(index, at, -1)"
        >↑</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          title="↓"
          :data-testid="`constraint-field-down-${index}-${at}`"
          @click="moveField(index, at, 1)"
        >↓</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          :data-testid="`constraint-remove-field-${index}-${at}`"
          @click="removeField(index, at)"
        >×</button>
      </div>
      <select
        v-if="freeFields(columnsOf(key).map((column) => column.fieldId)).length > 0"
        :class="styles.select"
        :data-testid="`constraint-add-field-${index}`"
        @change="(event) => addField(index, (event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t("add_field") }}</option>
        <option
          v-for="field in freeFields(columnsOf(key).map((column) => column.fieldId))"
          :key="String(field.id)"
          :value="String(field.id)"
        >{{ field.name }}</option>
      </select>
    </KeyCard>
  </div>
</template>
