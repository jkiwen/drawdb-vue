<script setup lang="ts">
import { computed, ref } from "vue";
import { createId } from "@drawdb/core";
import type { Relationship, RelationshipFieldPair, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import {
  canSavePairs,
  defaultForeignKeyName,
  pairsOf,
  syncPairs,
} from "./constraint-forms.ts";
import styles from "./edit-panel.module.css";
import KeyCard from "./KeyCard.vue";
import PairRows from "./PairRows.vue";

/**
 * The foreign keys of the selected table: a key is created by naming it,
 * choosing the table it points at and pairing its columns, and an existing
 * key edits the same pairs in place. Each key is a card (review of
 * 2026-10-29); its header states both ends, its body edits them. A foreign
 * key is a relationship of the child table in the model, so every write goes
 * through `addRelationship` / `updateRelationship` / `removeRelationship`.
 */
const props = defineProps<{
  table: Table;
  tables: readonly Table[];
  relationships: readonly Relationship[];
}>();

const diagram = useDiagramStore();
const ui = useUIStore();

const foreignKeys = computed(() =>
  props.relationships.filter(
    (relationship) => String(relationship.startTableId) === String(props.table.id),
  ),
);

const otherTables = computed(() =>
  props.tables.filter((table) => String(table.id) !== String(props.table.id)),
);

function tableById(id: unknown): Table | undefined {
  return props.tables.find((table) => String(table.id) === String(id));
}

function tableName(id: unknown): string {
  return tableById(id)?.name ?? String(id);
}

function pairsOfRelationship(relationship: Relationship): RelationshipFieldPair[] {
  return pairsOf(relationship);
}

function fieldName(table: Table | undefined, id: unknown): string {
  return table?.fields.find((field) => String(field.id) === String(id))?.name ?? String(id);
}

/** "orders.user_id → users.id" for the card header. */
function summaryOf(relationship: Relationship): string {
  const target = tableById(relationship.endTableId);
  return pairsOfRelationship(relationship)
    .map(
      (pair) =>
        `${fieldName(props.table, pair.startFieldId)} → ${fieldName(target, pair.endFieldId)}`,
    )
    .join(", ");
}

function writePairs(relationship: Relationship, pairs: RelationshipFieldPair[]): void {
  diagram.updateRelationship(relationship.id, syncPairs(pairs));
}

function rename(relationship: Relationship, name: string): void {
  diagram.updateRelationship(relationship.id, { name });
}

function changeTarget(relationship: Relationship, tableId: string): void {
  diagram.updateRelationship(relationship.id, {
    endTableId: tableId,
    endFieldId: "",
    fields: pairsOfRelationship(relationship).map((pair) => ({
      startFieldId: pair.startFieldId,
      endFieldId: "",
    })),
  });
}

function remove(relationship: Relationship): void {
  diagram.removeRelationship(relationship.id);
}

function open(relationship: Relationship): void {
  ui.selectRelationship(String(relationship.id));
}

/* The form of a new foreign key. */
const creating = ref(false);
const draftName = ref("");
const draftTarget = ref("");
const draftPairs = ref<RelationshipFieldPair[]>([]);

const draftTargetTable = computed(() => tableById(draftTarget.value));

const canCreate = computed(
  () => draftTarget.value !== "" && canSavePairs(draftPairs.value),
);

function openCreate(): void {
  creating.value = true;
  draftTarget.value = otherTables.value[0] ? String(otherTables.value[0].id) : "";
  draftName.value = draftTargetTable.value
    ? defaultForeignKeyName(props.table, draftTargetTable.value)
    : `fk_${props.table.name}`;
  draftPairs.value = [];
}

function cancelCreate(): void {
  creating.value = false;
}

function changeDraftTarget(tableId: string): void {
  draftTarget.value = tableId;
  const target = tableById(tableId);
  if (target) draftName.value = defaultForeignKeyName(props.table, target);
}

function create(): void {
  const target = draftTargetTable.value;
  if (!target || !canSavePairs(draftPairs.value)) return;
  const synced = syncPairs(draftPairs.value);
  diagram.addRelationship({
    id: createId(),
    name: draftName.value.trim() || defaultForeignKeyName(props.table, target),
    startTableId: props.table.id,
    startFieldId: synced.startFieldId,
    endTableId: target.id,
    endFieldId: synced.endFieldId,
    fields: synced.fields,
  });
  creating.value = false;
}
</script>

<template>
  <div :class="styles.rows" data-testid="table-foreign-keys">
    <header :class="styles['constraint-head']">
      <span :class="[styles.badge, styles['badge-info']]">{{ t("foreign_key") }}</span>
      <button
        v-if="!creating"
        type="button"
        :class="styles['link-button']"
        data-testid="constraint-add-foreign"
        @click="openCreate"
      >{{ t("add") }}</button>
    </header>

    <div v-if="creating" :class="styles['create-form']" data-testid="foreign-create">
      <label :class="styles.field">
        <span :class="styles.label">{{ t("name") }}</span>
        <input
          v-model="draftName"
          :class="styles.input"
          data-testid="foreign-create-name"
        />
      </label>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_foreign_target") }}</span>
        <select
          :class="styles.select"
          :value="draftTarget"
          data-testid="foreign-create-target"
          @change="changeDraftTarget(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="table in otherTables" :key="String(table.id)" :value="String(table.id)">
            {{ table.name }}
          </option>
        </select>
      </label>
      <PairRows
        :table="table"
        :target-table="draftTargetTable"
        :pairs="draftPairs"
        prefix="foreign-create"
        @update:pairs="(pairs) => (draftPairs = pairs)"
      />
      <div :class="styles['form-actions']">
        <button
          type="button"
          :class="styles['link-button']"
          :disabled="!canCreate"
          data-testid="foreign-create-confirm"
          @click="create"
        >{{ t("create") }}</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          data-testid="foreign-create-cancel"
          @click="cancelCreate"
        >{{ t("cancel") }}</button>
      </div>
    </div>

    <p v-if="foreignKeys.length === 0 && !creating" :class="styles.label" data-testid="foreign-keys-empty">
      {{ t("edit_panel_constraints_empty") }}
    </p>

    <KeyCard
      v-for="(relationship, index) in foreignKeys"
      :key="String(relationship.id)"
      :testid="`constraint-foreign-${index}`"
      badge="FK"
      :title="relationship.name ?? ''"
      :summary="`→ ${tableName(relationship.endTableId)}: ${summaryOf(relationship)}`"
    >
      <template #actions>
        <button
          type="button"
          :class="styles['link-button']"
          :title="t('open')"
          :data-testid="`constraint-open-foreign-${index}`"
          @click="open(relationship)"
        >{{ t("open") }}</button>
        <button
          type="button"
          :class="[styles['link-button'], styles['link-button--muted']]"
          :title="t('delete')"
          :data-testid="`constraint-remove-foreign-${index}`"
          @click="remove(relationship)"
        >×</button>
      </template>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("name") }}</span>
        <input
          :class="styles.input"
          :value="relationship.name ?? ''"
          :aria-label="t('foreign_key')"
          :data-testid="`constraint-name-foreign-${index}`"
          @change="(event) => rename(relationship, (event.target as HTMLInputElement).value)"
        />
      </label>
      <label :class="styles.field">
        <span :class="styles.label">{{ t("edit_panel_foreign_target") }}</span>
        <select
          :class="styles.select"
          :value="String(relationship.endTableId)"
          :data-testid="`constraint-target-foreign-${index}`"
          @change="(event) => changeTarget(relationship, (event.target as HTMLSelectElement).value)"
        >
          <option v-for="table in otherTables" :key="String(table.id)" :value="String(table.id)">
            {{ table.name }}
          </option>
        </select>
      </label>
      <PairRows
        :table="table"
        :target-table="tableById(relationship.endTableId)"
        :pairs="pairsOfRelationship(relationship)"
        :prefix="`foreign-${index}`"
        @update:pairs="(pairs) => writePairs(relationship, pairs)"
      />
    </KeyCard>
  </div>
</template>
