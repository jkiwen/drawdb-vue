<script setup lang="ts">
import type { Field, View, ViewColumn, ViewCondition, ViewJoin } from "@drawdb/core";
import { NButton } from "naive-ui";
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";

/**
 * One view: its name, its base table, its joins, its columns and its
 * conditions.
 *
 * The view is passed by the parent, which owns it — the tab writes it with
 * the commands of the store, and the properties of the editor can also write
 * the views of the host application with an event.
 */
const props = defineProps<{
  view: View;
}>();

const emit = defineEmits<{
  (e: "rename", name: string): void;
  (e: "update", updates: Partial<View>): void;
  (e: "remove"): void;
}>();

const diagram = useDiagramStore();

const view = computed(() => props.view);

/**
 * The tables of the diagram fill every drop down of the editor.
 */
const tables = computed(() => diagram.tables);

/**
 * The fields of one table, by the id of the table.
 */
function fieldsOf(tableId: string | number | null | undefined): Field[] {
  if (tableId == null) return [];
  const table = diagram.tables.find((entry) => String(entry.id) === String(tableId));
  return table ? table.fields : [];
}

/**
 * The value of an event of a native element, as text.
 */
function readValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function commitName(event: Event): void {
  const name = readValue(event).trim();
  if (name === "") return;
  if (name === props.view.name) return;
  emit("rename", name);
}

function update(updates: Partial<View>): void {
  emit("update", updates);
}

function updateJoin(position: number, updates: Partial<ViewJoin>): void {
  const joins = (props.view.joins ?? []).slice() as ViewJoin[];
  const join = { ...(joins[position] ?? {}) } as ViewJoin;
  joins[position] = Object.assign(join, updates);
  update({ joins });
}

function addJoin(): void {
  update({ joins: [...(props.view.joins ?? []), { id: `join_${(props.view.joins ?? []).length + 1}`, type: "one_to_one" } as ViewJoin] });
}

function removeJoin(position: number): void {
  update({ joins: (props.view.joins ?? []).filter((_, index) => index !== position) });
}

function updateColumn(position: number, updates: Partial<ViewColumn>): void {
  const columns = (props.view.columns ?? []).slice() as ViewColumn[];
  const column = { ...(columns[position] ?? {}) } as ViewColumn;
  columns[position] = Object.assign(column, updates);
  update({ columns });
}

function addColumn(): void {
  update({ columns: [...(props.view.columns ?? []), { id: `column_${(props.view.columns ?? []).length + 1}` } as ViewColumn] });
}

function removeColumn(position: number): void {
  update({ columns: (props.view.columns ?? []).filter((_, index) => index !== position) });
}

function updateCondition(position: number, updates: Partial<ViewCondition>): void {
  const conditions = (props.view.conditions ?? []).slice() as ViewCondition[];
  const condition = { ...(conditions[position] ?? {}) } as ViewCondition;
  conditions[position] = Object.assign(condition, updates);
  update({ conditions });
}

function addCondition(): void {
  update({
    conditions: [
      ...(props.view.conditions ?? []),
      { id: `condition_${(props.view.conditions ?? []).length + 1}`, connector: "AND" } as ViewCondition,
    ],
  });
}

function removeCondition(position: number): void {
  update({ conditions: (props.view.conditions ?? []).filter((_, index) => index !== position) });
}
</script>

<template>
  <section class="view-editor" :data-testid="'view-editor-' + view.id">
    <input
      class="view-editor__name"
      :data-testid="'view-name-' + view.id"
      :value="view.name"
      @change="commitName($event)"
    />

    <div class="view-editor__section">
      <div class="view-editor__section-title">Base table</div>
      <select
        class="view-editor__select"
        :data-testid="'view-base-table-' + view.id"
        :value="view.baseTableId == null ? '' : String(view.baseTableId)"
        @change="update({ baseTableId: readValue($event) || null })"
      >
        <option value="">—</option>
        <option v-for="table in tables" :key="table.id" :value="String(table.id)">
          {{ table.name }}
        </option>
      </select>
    </div>

    <div class="view-editor__section">
      <div class="view-editor__section-title">Joins</div>
      <div
        v-for="(join, position) in view.joins ?? []"
        :key="join.id ?? position"
        class="view-editor__row"
      >
        <select
          class="view-editor__select"
          :data-testid="'view-join-table-' + view.id + '-' + position"
          :value="join.tableId == null ? '' : String(join.tableId)"
          @change="updateJoin(position, { tableId: readValue($event) || null })"
        >
          <option value="">—</option>
          <option v-for="table in tables" :key="table.id" :value="String(table.id)">
            {{ table.name }}
          </option>
        </select>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="'remove-view-join-' + view.id + '-' + position"
          @click="removeJoin(position)"
        >
          ✕
        </NButton>
      </div>
      <NButton size="tiny" :data-testid="'add-view-join-' + view.id" @click="addJoin">
        Add Join
      </NButton>
    </div>

    <div class="view-editor__section">
      <div class="view-editor__section-title">Columns</div>
      <div
        v-for="(column, position) in view.columns ?? []"
        :key="column.id ?? position"
        class="view-editor__row"
      >
        <select
          class="view-editor__select"
          :data-testid="'view-column-table-' + view.id + '-' + position"
          :value="column.tableId == null ? '' : String(column.tableId)"
          @change="updateColumn(position, { tableId: readValue($event) || null, fieldId: null })"
        >
          <option value="">—</option>
          <option v-for="table in tables" :key="table.id" :value="String(table.id)">
            {{ table.name }}
          </option>
        </select>
        <select
          class="view-editor__select"
          :data-testid="'view-column-field-' + view.id + '-' + position"
          :value="column.fieldId == null ? '' : String(column.fieldId)"
          @change="updateColumn(position, { fieldId: readValue($event) || null })"
        >
          <option value="">—</option>
          <option v-for="field in fieldsOf(column.tableId)" :key="field.id" :value="String(field.id)">
            {{ field.name }}
          </option>
        </select>
        <input
          class="view-editor__alias"
          :data-testid="'view-column-alias-' + view.id + '-' + position"
          :value="column.alias ?? ''"
          @change="updateColumn(position, { alias: readValue($event) })"
        />
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="'remove-view-column-' + view.id + '-' + position"
          @click="removeColumn(position)"
        >
          ✕
        </NButton>
      </div>
      <NButton size="tiny" :data-testid="'add-view-column-' + view.id" @click="addColumn">
        Add Column
      </NButton>
    </div>

    <div class="view-editor__section">
      <div class="view-editor__section-title">Conditions</div>
      <div
        v-for="(condition, position) in view.conditions ?? []"
        :key="condition.id ?? position"
        class="view-editor__row"
      >
        <input
          class="view-editor__connector"
          :data-testid="'view-condition-connector-' + view.id + '-' + position"
          :value="condition.connector ?? 'AND'"
          @change="updateCondition(position, { connector: readValue($event) })"
        />
        <select
          class="view-editor__select"
          :data-testid="'view-condition-table-' + view.id + '-' + position"
          :value="condition.tableId == null ? '' : String(condition.tableId)"
          @change="updateCondition(position, { tableId: readValue($event) || null, fieldId: null })"
        >
          <option value="">—</option>
          <option v-for="table in tables" :key="table.id" :value="String(table.id)">
            {{ table.name }}
          </option>
        </select>
        <select
          class="view-editor__select"
          :data-testid="'view-condition-field-' + view.id + '-' + position"
          :value="condition.fieldId == null ? '' : String(condition.fieldId)"
          @change="updateCondition(position, { fieldId: readValue($event) || null })"
        >
          <option
            v-for="field in fieldsOf(condition.tableId)"
            :key="field.id"
            :value="String(field.id)"
          >
            {{ field.name }}
          </option>
        </select>
        <input
          class="view-editor__value"
          :data-testid="'view-condition-value-' + view.id + '-' + position"
          :value="String(condition.value ?? '')"
          @change="updateCondition(position, { value: readValue($event) })"
        />
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="'remove-view-condition-' + view.id + '-' + position"
          @click="removeCondition(position)"
        >
          ✕
        </NButton>
      </div>
      <NButton size="tiny" :data-testid="'add-view-condition-' + view.id" @click="addCondition">
        Add Condition
      </NButton>
    </div>
  </section>
</template>

<style scoped>
.view-editor { display: flex; flex-direction: column; gap: 6px; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }
.view-editor__section { display: flex; flex-direction: column; gap: 4px; }
.view-editor__section-title { font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.55); }
.view-editor__row { display: flex; align-items: center; gap: 4px; }
.view-editor__select, .view-editor__name, .view-editor__alias, .view-editor__value, .view-editor__connector { flex: 1 1 auto; min-width: 0; font-size: 12px; padding: 2px 4px; border: 1px solid rgba(0,0,0,0.15); border-radius: 3px; background: transparent; color: inherit; }
</style>
