<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import type { Field, Table } from "@drawdb/core";
import { VueDraggable } from "vue-draggable-plus";
import { tableRenderModel, type TableFieldRowModel } from "./render-model.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import { useSortable } from "../../composables/use-sortable.ts";
import { elementBounds, heldByLockedArea } from "../../utils/elements.ts";
import FieldHandle from "./FieldHandle.vue";
import ResizeHandles from "./ResizeHandles.vue";
import TableField from "./TableField.vue";
import TableHeader from "./TableHeader.vue";
import TableDetails from "./TableDetails.vue";

defineOptions({ name: "DrawDBTableNode" });

/**
 * A table of the diagram on the canvas.
 *
 * The same node draws both layers (UI document section 6.1): what it shows —
 * the title, the description, the rows, the key marks — is derived from the
 * view layer and the display toggles of the view-state store by the render
 * model (render-model.ts). Only the physical layer is editable on the
 * canvas: the rows of the logical layer are read-only and cannot be sorted.
 */
const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits([
  "select",
  "dragstart",
  "fieldselect",
  "linkstart",
  "resizestart",
]);

const diagram = useDiagramStore();
const viewState = useViewStateStore();
const resizing = ref(false);
const { sortableOptions, onSort } = useSortable();

// The table that is stored in the store, so that the edits on the canvas (the
// inline editing, the indices, the unique constraints) always work on the live
// object and never on a stale copy.
const liveTable = computed(() => diagram.tableById(props.table.id) ?? props.table);

/**
 * The ids of the fields a foreign key points from, so the "all" display
 * mode can mark them with "FK" (UI document section 6.1).
 */
const foreignFieldIds = computed(() => {
  const ids = new Set<string>();
  for (const relationship of diagram.relationships) {
    if (String(relationship.endTableId) === String(liveTable.value.id)) {
      ids.add(String(relationship.endFieldId));
    }
  }
  return ids;
});

/**
 * The render model of the table: everything the node draws, derived from
 * the view layer and the display toggles. The height comes from the model
 * as well, so the node, the virtualization and the relationship anchors all
 * measure the table the same way.
 */
const model = computed(() =>
  tableRenderModel(liveTable.value, viewState.viewLayer, viewState.toggles, {
    foreignFieldIds: foreignFieldIds.value,
  }),
);

const width = computed(() => model.value.width);
const height = computed(() => model.value.height);

/** Only the physical layer is edited on the canvas. */
const editable = computed(
  () => viewState.viewLayer === "physical" && !locked.value,
);

/** The physical field a row edits and anchors, when it has one. */
function fieldOf(row: TableFieldRowModel): Field | undefined {
  if (row.fieldId === undefined) {
    return undefined;
  }
  return liveTable.value.fields.find(
    (field) => String(field.id) === String(row.fieldId),
  );
}

/**
 * Whether the table is locked.
 *
 * A locked table is a table the user does not want to touch any more, so the
 * canvas refuses to move it, to resize it and to change its fields. The lock
 * of an area extends to the tables the area holds, so a table inside a locked
 * area is read-only the same way. The store refuses the changes as well,
 * because the side panel writes to the same table.
 */
const locked = computed(
  () =>
    liveTable.value.locked === true ||
    heldByLockedArea(diagram.areas ?? [], elementBounds(liveTable.value)),
);

function onPointerDown(event: PointerEvent): void {
  if (locked.value) {
    return;
  }
  emit("dragstart", { id: props.table.id, event });
}

function onFieldSelect(payload: {
  tableId: string | number;
  fieldId: string | number;
  event: PointerEvent;
}): void {
  if (locked.value) {
    return;
  }
  emit("fieldselect", payload);
}

function onLinkStart(payload: {
  tableId: string | number;
  fieldId: string | number;
  event: PointerEvent;
}): void {
  if (locked.value) {
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
  if (locked.value) {
    return;
  }
  resizing.value = true;
  emit("resizestart", payload);
}

function onToggleLock(): void {
  diagram.toggleTableLock(props.table.id);
}

function onToggleDetails(): void {
  diagram.toggleTableDetails(props.table.id);
}

function onDragEnd(event: { oldIndex?: number; newIndex?: number }): void {
  if (event.oldIndex === undefined || event.newIndex === undefined) {
    return;
  }
  if (locked.value) {
    return;
  }
  onSort(props.table.id, event.oldIndex, event.newIndex);
}

defineExpose({ resizing });
</script>

<template>
  <g
    class="ddb-table"
    :class="{ 'is-selected': selected, 'is-locked': locked }"
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
          :model="model"
          :selected="selected"
          :locked="locked"
          :editable="editable"
          @togglelock="onToggleLock"
          @toggledetails="onToggleDetails"
        />
        <TableDetails
          v-if="liveTable.details === true && liveTable.collapsed !== true"
          class="ddb-table__details"
          :data-testid="`table-details-${table.id}`"
          :table="liveTable"
          :locked="locked"
          @pointerdown.stop
        />
        <VueDraggable
          v-if="editable"
          :model-value="liveTable.fields"
          v-bind="sortableOptions"
          @end="onDragEnd"
          tag="div"
          class="ddb-table__fields"
        >
          <div
            v-for="row in model.rows"
            :key="row.rowId"
            class="ddb-table__row"
          >
            <TableField
              :table="liveTable"
              :row="row"
              :field="fieldOf(row)"
              :locked="locked"
              :editable="editable"
              :show-marks="model.showKeyMarks"
              @fieldselect="onFieldSelect"
            />
            <FieldHandle
              v-if="row.fieldId !== undefined"
              :table-id="liveTable.id"
              :field-id="row.fieldId"
              @linkstart="onLinkStart"
            />
          </div>
        </VueDraggable>
        <div v-else class="ddb-table__fields">
          <div
            v-for="row in model.rows"
            :key="row.rowId"
            class="ddb-table__row"
          >
            <TableField
              :table="liveTable"
              :row="row"
              :field="fieldOf(row)"
              :locked="locked"
              :editable="false"
              :show-marks="model.showKeyMarks"
              @fieldselect="onFieldSelect"
            />
            <FieldHandle
              v-if="row.fieldId !== undefined"
              :table-id="liveTable.id"
              :field-id="row.fieldId"
              @linkstart="onLinkStart"
            />
          </div>
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
