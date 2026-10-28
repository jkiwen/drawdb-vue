<script setup lang="ts">
import { computed } from "vue";
import { createId } from "@drawdb/core";
import type { FieldId, Relationship, Table, UniqueConstraint } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import styles from "./edit-panel.module.css";

/**
 * The constraints group of the edit panel: the primary key, the unique
 * constraints and the foreign keys of the selected table (issues 5 to 7).
 *
 * The primary key has no name of its own in the model — a key of a table can
 * only be the primary one — so it is shown under the SQL name `PRIMARY`. A
 * unique key owns a name and an ordered list of columns; a foreign key lives
 * as the relationship of the child table, so its name is written through
 * `updateRelationship` and its columns are the fields of that relationship.
 */
const props = defineProps<{
  table: Table;
  relationships: readonly Relationship[];
}>();

const diagram = useDiagramStore();
const ui = useUIStore();

const PRIMARY_NAME = "PRIMARY";

const primaryFields = computed(() =>
  props.table.fields.filter((field) => field.primary === true),
);
const uniqueKeys = computed<UniqueConstraint[]>(
  () => props.table.uniqueConstraints ?? [],
);
const foreignKeys = computed(() =>
  props.relationships.filter(
    (relationship) => String(relationship.startTableId) === String(props.table.id),
  ),
);

const fieldName = (id: FieldId): string =>
  props.table.fields.find((field) => String(field.id) === String(id))?.name ??
  String(id);

/** The fields a constraint could still gain, by role. */
function freeFields(taken: readonly FieldId[]) {
  const used = new Set(taken.map(String));
  return props.table.fields.filter((field) => !used.has(String(field.id)));
}

function togglePrimary(fieldId: FieldId, on: boolean): void {
  diagram.updateField(props.table.id, fieldId, { primary: on });
}

function writeUniqueKeys(next: UniqueConstraint[]): void {
  diagram.updateTable(props.table.id, { uniqueConstraints: next });
}

function renameUnique(index: number, name: string): void {
  const next = uniqueKeys.value.map((key, at) =>
    at === index ? { ...key, name } : key,
  );
  writeUniqueKeys(next);
}

function moveUniqueField(index: number, at: number, delta: -1 | 1): void {
  const key = uniqueKeys.value[index];
  if (!key) return;
  const to = at + delta;
  if (to < 0 || to >= key.fields.length) return;
  const fields = [...key.fields];
  const [moved] = fields.splice(at, 1);
  fields.splice(to, 0, moved!);
  writeUniqueKeys(
    uniqueKeys.value.map((item, i) => (i === index ? { ...item, fields } : item)),
  );
}

function removeUniqueField(index: number, at: number): void {
  const key = uniqueKeys.value[index];
  if (!key) return;
  const fields = key.fields.filter((_, i) => i !== at);
  writeUniqueKeys(
    uniqueKeys.value.map((item, i) => (i === index ? { ...item, fields } : item)),
  );
}

function addUniqueField(index: number, event: Event): void {
  const fieldId = (event.target as HTMLSelectElement).value;
  if (fieldId === "") return;
  const key = uniqueKeys.value[index];
  if (!key) return;
  const fields = [...key.fields, fieldId];
  writeUniqueKeys(
    uniqueKeys.value.map((item, i) => (i === index ? { ...item, fields } : item)),
  );
  (event.target as HTMLSelectElement).value = "";
}

/** Adds a unique key named after the table, the way the canvas names them. */
function addUnique(): void {
  const taken = uniqueKeys.value.map((key) => key.name);
  let index = taken.length + 1;
  while (taken.includes(`uk_${props.table.name}_${index}`)) index += 1;
  writeUniqueKeys([
    ...uniqueKeys.value,
    { id: createId(), name: `uk_${props.table.name}_${index}`, fields: [] },
  ]);
}

function removeUnique(index: number): void {
  writeUniqueKeys(uniqueKeys.value.filter((_, i) => i !== index));
}

function renameForeignKey(relationship: Relationship, name: string): void {
  diagram.updateRelationship(relationship.id, { name });
}

function openForeignKey(relationship: Relationship): void {
  ui.selectRelationship(String(relationship.id));
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

    <section :class="styles['constraint-block']" data-testid="constraint-unique">
      <header :class="styles['constraint-head']">
        <span :class="[styles.badge, styles['badge-info']]">{{ t("unique_constraints") }}</span>
        <button
          type="button"
          :class="styles['add-button']"
          data-testid="constraint-add-unique"
          @click="addUnique"
        >＋ {{ t("add") }}</button>
      </header>
      <p v-if="uniqueKeys.length === 0" :class="styles.label" data-testid="unique-keys-empty">
        {{ t("edit_panel_constraints_empty") }}
      </p>
      <div
        v-for="(key, index) in uniqueKeys"
        :key="String(key.id ?? index)"
        :class="styles['constraint-block']"
        data-testid="constraint-unique-row"
      >
        <div :class="styles['constraint-head']">
          <input
            :class="styles.input"
            :value="key.name"
            :aria-label="t('unique_constraints')"
            :data-testid="`constraint-name-unique-${index}`"
            @change="(event) => renameUnique(index, (event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            :class="styles['icon-button']"
            :title="t('delete')"
            :data-testid="`constraint-remove-unique-${index}`"
            @click="removeUnique(index)"
          >×</button>
        </div>
        <div
          v-for="(fieldId, at) in key.fields"
          :key="`${String(fieldId)}-${at}`"
          :class="styles['constraint-row']"
          data-testid="constraint-unique-field"
        >
          <span :class="styles['constraint-fields']">{{ fieldName(fieldId) }}</span>
          <button
            type="button"
            :class="styles['icon-button']"
            title="↑"
            :data-testid="`constraint-field-up-${index}-${at}`"
            @click="moveUniqueField(index, at, -1)"
          >↑</button>
          <button
            type="button"
            :class="styles['icon-button']"
            title="↓"
            :data-testid="`constraint-field-down-${index}-${at}`"
            @click="moveUniqueField(index, at, 1)"
          >↓</button>
          <button
            type="button"
            :class="styles['icon-button']"
            :title="t('delete')"
            :data-testid="`constraint-remove-field-${index}-${at}`"
            @click="removeUniqueField(index, at)"
          >×</button>
        </div>
        <select
          v-if="freeFields(key.fields).length > 0"
          :class="styles.select"
          :data-testid="`constraint-add-field-${index}`"
          @change="(event) => addUniqueField(index, event)"
        >
          <option value="">{{ t("add_field") }}</option>
          <option
            v-for="field in freeFields(key.fields)"
            :key="String(field.id)"
            :value="String(field.id)"
          >{{ field.name }}</option>
        </select>
      </div>
    </section>

    <section :class="styles['constraint-block']" data-testid="constraint-foreign">
      <header :class="styles['constraint-head']">
        <span :class="[styles.badge, styles['badge-info']]">{{ t("foreign_key") }}</span>
      </header>
      <p v-if="foreignKeys.length === 0" :class="styles.label" data-testid="foreign-keys-empty">
        {{ t("edit_panel_constraints_empty") }}
      </p>
      <div
        v-for="(relationship, index) in foreignKeys"
        :key="String(relationship.id)"
        :class="styles['constraint-row']"
        data-testid="constraint-foreign-row"
      >
        <input
          :class="styles.input"
          :value="relationship.name ?? ''"
          :aria-label="t('foreign_key')"
          :data-testid="`constraint-name-foreign-${index}`"
          @change="(event) => renameForeignKey(relationship, (event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          :class="styles['add-button']"
          :title="t('open')"
          :data-testid="`constraint-open-foreign-${index}`"
          @click="openForeignKey(relationship)"
        >{{ t("open") }}</button>
      </div>
    </section>
  </div>
</template>
