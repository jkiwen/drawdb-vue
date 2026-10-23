<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { useUIStore } from "../../stores/ui.ts";
import { fieldLabel, tableHeight, tableWidth } from "./geometry.ts";

defineOptions({ name: "DrawDBTableNode" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
  showFieldTypes: { type: Boolean, default: true },
});

const emit = defineEmits(["select", "dragstart", "fieldselect"]);

const ui = useUIStore();

const width = computed(() => tableWidth(props.table));
const height = computed(() => tableHeight(props.table));

/**
 * The types of the fields are a property of the physical view.
 *
 * The logical view only shows the names of the entities and their relations.
 */
const showsFieldTypes = computed(
  () => props.showFieldTypes && ui.viewMode !== "logical",
);

const headerStyle = computed(() => {
  if (!props.table.color) {
    return {};
  }
  return { borderTopColor: props.table.color };
});

function onPointerDown(event: PointerEvent): void {
  emit("dragstart", { id: props.table.id, event });
}

function onFieldPointerDown(fieldId: string | number, event: PointerEvent): void {
  emit("fieldselect", { tableId: props.table.id, fieldId, event });
}
</script>

<template>
  <g
    class="ddb-table"
    :class="{ 'is-selected': selected, 'is-locked': table.locked }"
    :transform="`translate(${table.x} ${table.y})`"
    :data-testid="`table-${table.id}`"
    @pointerdown.stop="onPointerDown"
  >
    <foreignObject :width="width" :height="height">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="ddb-table__body"
        :class="{ 'is-selected': selected }"
      >
        <div class="ddb-table__header" :style="headerStyle">
          <span class="ddb-table__name">{{ table.name }}</span>
          <span v-if="table.comment" class="ddb-table__comment">
            {{ table.comment }}
          </span>
        </div>
        <div
          v-for="field in table.fields"
          :key="field.id"
          class="ddb-table__field"
          :data-testid="`field-${table.id}-${field.id}`"
          @pointerdown.stop="onFieldPointerDown(field.id, $event)"
        >
          <span class="ddb-table__field-name">{{ field.name }}</span>
          <span
            v-if="showsFieldTypes"
            class="ddb-table__field-type"
            data-testid="field-type"
            :data-field-id="field.id"
          >
            {{ fieldLabel(field) }}
          </span>
        </div>
      </div>
    </foreignObject>
  </g>
</template>
