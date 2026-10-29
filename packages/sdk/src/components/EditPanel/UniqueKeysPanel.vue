<script setup lang="ts">
import { computed, ref } from "vue";
import { createId } from "@drawdb/core";
import type { FieldId, Table, UniqueConstraint } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { nextUniqueName } from "./constraint-forms.ts";
import styles from "./edit-panel.module.css";
import KeyCard from "./KeyCard.vue";

/**
 * The unique keys of the selected table: a key is created by naming it, then
 * edited the way the primary key is — columns are added from a picker,
 * ordered and removed. Each key is a card (review of 2026-10-29).
 */
const props = defineProps<{ table: Table }>();

const diagram = useDiagramStore();

const keys = computed<UniqueConstraint[]>(() => props.table.uniqueConstraints ?? []);

const creating = ref(false);
const draftName = ref("");

const fieldName = (id: FieldId): string =>
  props.table.fields.find((field) => String(field.id) === String(id))?.name ?? String(id);

function summaryOf(key: UniqueConstraint): string {
  return key.fields.length > 0 ? `(${key.fields.map(fieldName).join(", ")})` : "";
}

function freeFields(taken: readonly string[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function write(next: UniqueConstraint[]): void {
  diagram.updateTable(props.table.id, { uniqueConstraints: next });
}

function openCreate(): void {
  draftName.value = nextUniqueName(props.table);
  creating.value = true;
}

function cancelCreate(): void {
  creating.value = false;
}

function confirmCreate(): void {
  const name = draftName.value.trim() || nextUniqueName(props.table);
  write([...keys.value, { id: createId(), name, fields: [] }]);
  creating.value = false;
}

function rename(index: number, name: string): void {
  write(keys.value.map((key, at) => (at === index ? { ...key, name } : key)));
}

function remove(index: number): void {
  write(keys.value.filter((_, at) => at !== index));
}

function addField(index: number, fieldId: string): void {
  if (fieldId === "") return;
  write(
    keys.value.map((key, at) =>
      at === index ? { ...key, fields: [...key.fields, fieldId] } : key,
    ),
  );
}

function removeField(index: number, at: number): void {
  write(
    keys.value.map((key, position) =>
      position === index ? { ...key, fields: key.fields.filter((_, i) => i !== at) } : key,
    ),
  );
}

function moveField(index: number, at: number, delta: -1 | 1): void {
  const key = keys.value[index];
  if (!key) return;
  const to = at + delta;
  if (to < 0 || to >= key.fields.length) return;
  const fields = [...key.fields];
  const [moved] = fields.splice(at, 1);
  fields.splice(to, 0, moved!);
  write(keys.value.map((item, position) => (position === index ? { ...item, fields } : item)));
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
        <span :class="styles.label">{{ t("name") }}</span>
        <input
          :class="styles.input"
          :value="key.name"
          :aria-label="t('unique_constraints')"
          :data-testid="`constraint-name-unique-${index}`"
          @change="(event) => rename(index, (event.target as HTMLInputElement).value)"
        />
      </label>
      <div
        v-for="(fieldId, at) in key.fields"
        :key="`${String(fieldId)}-${at}`"
        :class="styles['constraint-row']"
        data-testid="constraint-unique-field"
      >
        <span :class="styles['constraint-fields']">{{ fieldName(fieldId) }}</span>
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
        v-if="freeFields(key.fields.map(String)).length > 0"
        :class="styles.select"
        :data-testid="`constraint-add-field-${index}`"
        @change="(event) => addField(index, (event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t("add_field") }}</option>
        <option
          v-for="field in freeFields(key.fields.map(String))"
          :key="String(field.id)"
          :value="String(field.id)"
        >{{ field.name }}</option>
      </select>
    </KeyCard>
  </div>
</template>
