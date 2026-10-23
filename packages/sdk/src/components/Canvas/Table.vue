<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { tableHeight, tableWidth } from "./geometry.ts";
import FieldHandle from "./FieldHandle.vue";
import ResizeHandles from "./ResizeHandles.vue";
import TableField from "./TableField.vue";
import TableHeader from "./TableHeader.vue";

defineOptions({ name: "DrawDBTableNode" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
  showFieldTypes: { type: Boolean, default: true },
});

const emit = defineEmits([
  "select",
  "dragstart",
  "fieldselect",
  "linkstart",
  "resizestart",
]);

const width = computed(() => tableWidth(props.table));
const height = computed(() => tableHeight(props.table));

function onPointerDown(event: PointerEvent): void {
  emit("dragstart", { id: props.table.id, event });
}

function onFieldSelect(payload: {
  tableId: string | number;
  fieldId: string | number;
  event: PointerEvent;
}): void {
  emit("fieldselect", payload);
}

function onLinkStart(payload: {
  tableId: string | number;
  fieldId: string | number;
  event: PointerEvent;
}): void {
  emit("linkstart", payload);
}

function onResizeStart(payload: {
  tableId: string | number;
  width: number;
  height: number;
  event: PointerEvent;
}): void {
  emit("resizestart", payload);
}
</script>

<template>
  <g
    class="ddb-table"
    :class="{ 'is-selected': selected, 'is-locked': table.locked }"
    :transform="`translate(${table.x} ${table.y})`"
    :data-table-id="table.id"
    :data-testid="`table-${table.id}`"
    @pointerdown.stop="onPointerDown"
  >
    <foreignObject :width="width" :height="height">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="ddb-table__body"
        :class="{ 'is-selected': selected }"
      >
        <TableHeader :table="table" :selected="selected" />
        <div
          v-for="field in table.fields"
          :key="field.id"
          class="ddb-table__row"
        >
          <TableField
            :table="table"
            :field="field"
            :show-field-types="showFieldTypes"
            @fieldselect="onFieldSelect"
          />
          <FieldHandle
            :table-id="table.id"
            :field-id="field.id"
            @linkstart="onLinkStart"
          />
        </div>
        <ResizeHandles
          :table-id="table.id"
          :width="width"
          :height="height"
          @resizestart="onResizeStart"
        />
      </div>
    </foreignObject>
  </g>
</template>
