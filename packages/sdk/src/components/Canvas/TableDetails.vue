<script setup lang="ts">
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NButton } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

defineOptions({ name: "DrawDBTableDetails" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
});

const diagram = useDiagramStore();

function onColorInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  diagram.updateTable(props.table.id, { color: value || undefined });
}

/** The list of the names of an index or of a unique constraint, as written by the user. */
function readFields(event: Event): string[] {
  return (event.target as HTMLInputElement).value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

/** Replaces one index of the table. */
function replaceIndex(position: number, next: Record<string, unknown>): void {
  const indices = [...(props.table.indices ?? [])];
  indices[position] = { ...indices[position], ...next } as (typeof indices)[number];
  diagram.updateTable(props.table.id, { indices });
}

/** Replaces one unique constraint of the table. */
function replaceUnique(position: number, next: Record<string, unknown>): void {
  const uniques = [...(props.table.uniqueConstraints ?? [])];
  uniques[position] = { ...uniques[position], ...next } as (typeof uniques)[number];
  diagram.updateTable(props.table.id, { uniqueConstraints: uniques });
}

function addIndex(): void {
  const indices = [...(props.table.indices ?? []), { name: "", unique: false, fields: [] }];
  diagram.updateTable(props.table.id, { indices });
}

function addUnique(): void {
  const uniques = [...(props.table.uniqueConstraints ?? []), { name: "", fields: [] }];
  diagram.updateTable(props.table.id, { uniqueConstraints: uniques });
}
</script>

<template>
  <div @pointerdown.stop>
    <label>
      Color
      <input
        type="color"
        class="ddb-table__details-color"
        :data-testid="`table-color-${table.id}`"
        :value="table.color ?? '#175e7a'"
        @change="onColorInput"
      />
    </label>

    <div class="ddb-table__details-indices">
      <div class="ddb-table__details-section-title">Indices</div>
      <div
        v-for="(index, indexPos) in table.indices ?? []"
        :key="index.id ?? indexPos"
        class="ddb-table__details-index"
      >
        <input
          class="ddb-table__details-index-name"
          :data-testid="`table-index-name-${table.id}-${indexPos}`"
          :value="index.name ?? ''"
          @change="replaceIndex(indexPos, { name: ($event.target as HTMLInputElement).value })"
        />
        <input
          class="ddb-table__details-index-fields"
          :data-testid="`table-index-fields-${table.id}-${indexPos}`"
          :value="index.fields.join(', ')"
          @change="replaceIndex(indexPos, { fields: readFields($event) })"
        />
      </div>
      <NButton
        size="tiny"
        class="ddb-table__details-add-index"
        :data-testid="`table-add-index-${table.id}`"
        @click="addIndex"
      >
        Add Index
      </NButton>
    </div>

    <div class="ddb-table__details-unique">
      <div class="ddb-table__details-section-title">Unique Constraints</div>
      <div
        v-for="(constraint, constraintPos) in table.uniqueConstraints ?? []"
        :key="constraint.id ?? constraintPos"
        class="ddb-table__details-unique-row"
      >
        <input
          class="ddb-table__details-unique-name"
          :data-testid="`table-unique-name-${table.id}-${constraintPos}`"
          :value="constraint.name ?? ''"
          @change="replaceUnique(constraintPos, { name: ($event.target as HTMLInputElement).value })"
        />
        <input
          class="ddb-table__details-unique-fields"
          :data-testid="`table-unique-fields-${table.id}-${constraintPos}`"
          :value="constraint.fields.join(', ')"
          @change="replaceUnique(constraintPos, { fields: readFields($event) })"
        />
      </div>
      <NButton
        size="tiny"
        class="ddb-table__details-add-unique"
        :data-testid="`table-add-unique-${table.id}`"
        @click="addUnique"
      >
        Add Unique
      </NButton>
    </div>
  </div>
</template>
