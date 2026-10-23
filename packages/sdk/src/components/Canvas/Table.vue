<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { VueDraggable } from "vue-draggable-plus";
import { tableHeight, tableWidth } from "./geometry.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useSortable } from "../../composables/use-sortable.ts";
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

const diagram = useDiagramStore();
const resizing = ref(false);
const { sortableOptions, onSort } = useSortable();

const width = computed(() => tableWidth(props.table));
const height = computed(() => tableHeight(props.table));

// The table that is stored in the store, so that the edits on the canvas (the
// inline editing, the indices, the unique constraints) always work on the live
// object and never on a stale copy.
const liveTable = computed(() => diagram.tableById(props.table.id) ?? props.table);

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
  if (props.table.locked) {
    return;
  }
  emit("linkstart", payload);
}

function onResizeStart(payload: {
  tableId: string | number;
  width: number;
  height: number;
  event: PointerEvent;
}): void {
  resizing.value = true;
  emit("resizestart", payload);
}

function onToggleLock(): void {
  diagram.toggleTableLock(props.table.id);
}

function onDragEnd(event: { oldIndex?: number; newIndex?: number }): void {
  if (event.oldIndex === undefined || event.newIndex === undefined) {
    return;
  }
  onSort(props.table.id, event.oldIndex, event.newIndex);
}

defineExpose({ resizing });
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
        <TableHeader
          :table="liveTable"
          :selected="selected"
          @togglelock="onToggleLock"
        />
        <VueDraggable
          :model-value="liveTable.fields"
          v-bind="sortableOptions"
          @end="onDragEnd"
          tag="div"
          class="ddb-table__fields"
        >
          <div
            v-for="field in liveTable.fields"
            :key="field.id"
            class="ddb-table__row"
          >
            <TableField
              :table="liveTable"
              :field="field"
              :show-field-types="showFieldTypes"
              @fieldselect="onFieldSelect"
            />
            <FieldHandle
              :table-id="liveTable.id"
              :field-id="field.id"
              @linkstart="onLinkStart"
            />
          </div>
        </VueDraggable>
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
