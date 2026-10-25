<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NButton, NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

/**
 * The details of a table: its colour, its indices and its unique
 * constraints.
 *
 * The block sits inside the body of the table, between the header and the
 * fields, and the table grows to fit it. Every row has a fixed height so
 * that the geometry of the table stays exact (see tableDetailsHeight in
 * geometry.ts). While the table is locked the details stay read-only: the
 * lock stops changes, not looking.
 */
const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  locked: { type: Boolean, default: false },
});

defineOptions({ name: "DrawDBTableDetails" });

const diagram = useDiagramStore();

const locked = computed(() => props.locked || props.table.locked === true);

function onColorInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  diagram.updateTable(props.table.id, { color: value || undefined });
}

function readFields(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function replaceIndex(position: number, next: Record<string, unknown>): void {
  const indices = (props.table.indices ?? []).map((entry, index) =>
    index === position ? { ...entry, ...next } : entry,
  );
  diagram.updateTable(props.table.id, { indices });
}

function replaceUnique(position: number, next: Record<string, unknown>): void {
  const uniqueConstraints = (props.table.uniqueConstraints ?? []).map((entry, index) =>
    index === position ? { ...entry, ...next } : entry,
  );
  diagram.updateTable(props.table.id, { uniqueConstraints });
}

function addIndex(): void {
  const indices = [...(props.table.indices ?? []), { name: "", unique: false, fields: [] }];
  diagram.updateTable(props.table.id, { indices });
}

function addUnique(): void {
  const uniqueConstraints = [...(props.table.uniqueConstraints ?? []), { name: "", fields: [] }];
  diagram.updateTable(props.table.id, { uniqueConstraints });
}
</script>

<template>
  <div class="ddb-table__details" @pointerdown.stop>
    <label class="ddb-table__details-color-row">
      <input
        type="color"
        class="ddb-table__details-color"
        :data-testid="`table-color-${table.id}`"
        :value="table.color ?? '#175e7a'"
        :disabled="locked"
        @change="onColorInput"
      />
      <span>Color</span>
    </label>

    <div class="ddb-table__details-section">
      <p class="ddb-table__details-section-title">Indices</p>
      <div
        v-for="(index, indexPosition) in table.indices"
        :key="index.id ?? indexPosition"
        class="ddb-table__details-row"
      >
        <NInput
          size="tiny"
          class="ddb-table__details-input"
          :value="index.name"
          :disabled="locked"
          :data-testid="`table-index-name-${table.id}-${indexPosition}`"
          placeholder="Index name"
          @update:value="(value: string) => replaceIndex(indexPosition, { name: value })"
        />
        <NInput
          size="tiny"
          class="ddb-table__details-input"
          :value="index.fields.join(', ')"
          :disabled="locked"
          :data-testid="`table-index-fields-${table.id}-${indexPosition}`"
          placeholder="Fields, comma separated"
          @update:value="
            (value: string) => replaceIndex(indexPosition, { fields: readFields(value) })
          "
        />
      </div>
      <div v-if="!locked" class="ddb-table__details-actions">
        <NButton
          size="tiny"
          class="ddb-table__details-add-index"
          :data-testid="`table-add-index-${table.id}`"
          @click="addIndex"
        >
          Add Index
        </NButton>
      </div>
    </div>

    <div class="ddb-table__details-section">
      <p class="ddb-table__details-section-title">Unique Constraints</p>
      <div
        v-for="(unique, uniquePosition) in table.uniqueConstraints"
        :key="unique.id ?? uniquePosition"
        class="ddb-table__details-row"
      >
        <NInput
          size="tiny"
          class="ddb-table__details-input"
          :value="unique.name"
          :disabled="locked"
          :data-testid="`table-unique-name-${table.id}-${uniquePosition}`"
          placeholder="Constraint name"
          @update:value="(value: string) => replaceUnique(uniquePosition, { name: value })"
        />
        <NInput
          size="tiny"
          class="ddb-table__details-input"
          :value="unique.fields.join(', ')"
          :disabled="locked"
          :data-testid="`table-unique-fields-${table.id}-${uniquePosition}`"
          placeholder="Fields, comma separated"
          @update:value="
            (value: string) => replaceUnique(uniquePosition, { fields: readFields(value) })
          "
        />
      </div>
      <div v-if="!locked" class="ddb-table__details-actions">
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
  </div>
</template>
