<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Field, Table } from "@drawdb/core";
import { useUIStore } from "../../stores/ui.ts";
import { fieldLabel } from "./geometry.ts";

defineOptions({ name: "DrawDBTableField" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  field: { type: Object as PropType<Field>, required: true },
  selected: { type: Boolean, default: false },
  showFieldTypes: { type: Boolean, default: true },
});

const emit = defineEmits(["fieldselect"]);

const ui = useUIStore();

/**
 * The types of the fields are a property of the physical view.
 *
 * The logical view only shows the names of the entities and their relations.
 */
const showsFieldTypes = computed(
  () => props.showFieldTypes && ui.viewMode !== "logical",
);

function onPointerDown(event: PointerEvent): void {
  emit("fieldselect", {
    tableId: props.table.id,
    fieldId: props.field.id,
    event,
  });
}
</script>

<template>
  <div
    class="ddb-table__field"
    :class="{ 'is-selected': selected }"
    :data-table-id="table.id"
    :data-field-id="field.id"
    :data-testid="`field-${table.id}-${field.id}`"
    @pointerdown.stop="onPointerDown"
  >
    <span class="ddb-table__field-name">{{ field.name }}</span>
    <span
      v-if="field.primary"
      class="ddb-table__field-mark"
      data-testid="field-primary"
    >
      PK
    </span>
    <span
      v-if="field.notNull"
      class="ddb-table__field-mark"
      data-testid="field-not-null"
    >
      NN
    </span>
    <span
      v-if="showsFieldTypes"
      class="ddb-table__field-type"
      data-testid="field-type"
      :data-field-id="field.id"
    >
      {{ fieldLabel(field) }}
    </span>
  </div>
</template>
