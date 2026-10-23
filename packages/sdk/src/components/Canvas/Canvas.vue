<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useCanvasEvents } from "../../composables/use-canvas-events.ts";
import { useCanvasItems } from "../../composables/use-canvas-items.ts";
import Area from "./Area.vue";
import ContextMenu from "./ContextMenu.vue";
import LogicalRelationship from "./LogicalRelationship.vue";
import LogicalTable from "./LogicalTable.vue";
import Note from "./Note.vue";
import Relationship from "./Relationship.vue";
import Table from "./Table.vue";
import View from "./View.vue";
import { useCanvasHandlers } from "./interactions/use-canvas-handlers.ts";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
} from "./geometry.ts";

defineOptions({ name: "DrawDBCanvas" });

const props = withDefaults(
  defineProps<{
    width?: number;
    height?: number;
    gridSize?: number;
  }>(),
  {
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
    gridSize: DEFAULT_GRID_SIZE,
  },
);

const diagram = useDiagramStore();
const svgRef = ref<SVGSVGElement | null>(null);

const items = useCanvasItems({
  width: () => props.width,
  height: () => props.height,
});

const canvas = useCanvasHandlers({
  gridSize: () => props.gridSize,
  rect: () => {
    const rect = svgRef.value?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      width: rect?.width ?? props.width,
      height: rect?.height ?? props.height,
    };
  },
});

const canvasEvents = useCanvasEvents(canvas.handlers);

onMounted(() => {
  if (svgRef.value) {
    canvasEvents.attach(svgRef.value);
  }
});

onBeforeUnmount(() => {
  canvasEvents.detach();
});
</script>

<template>
  <svg
    ref="svgRef"
    class="ddb-canvas"
    :width="width"
    :height="height"
    data-testid="canvas"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      class="ddb-canvas__content"
      :transform="items.transform.value"
      data-testid="canvas-content"
    >
      <Area
        v-for="area in items.visibleAreas.value"
        :key="`area-${area.id}`"
        :area="area"
        :selected="canvas.selection.isSelected(String(area.id))"
      />
      <template
        v-for="relationship in items.visibleRelationships.value"
        :key="`relationship-${relationship.id}`"
      >
        <LogicalRelationship
          v-if="items.isLogical.value"
          :relationship="relationship"
          :start-table="diagram.tableById(relationship.startTableId)!"
          :end-table="diagram.tableById(relationship.endTableId)!"
          :selected="canvas.selection.isSelected(String(relationship.id))"
        />
        <Relationship
          v-else
          :relationship="relationship"
          :start-table="diagram.tableById(relationship.startTableId)!"
          :end-table="diagram.tableById(relationship.endTableId)!"
          :selected="canvas.selection.isSelected(String(relationship.id))"
        />
      </template>
      <template
        v-for="table in items.visibleTables.value"
        :key="`table-${table.id}`"
      >
        <LogicalTable
          v-if="items.isLogical.value"
          :table="table"
          :selected="canvas.selection.isSelected(String(table.id))"
          @dragstart="canvas.onTableDragStart"
        />
        <Table
          v-else
          :table="table"
          :selected="canvas.selection.isSelected(String(table.id))"
          @dragstart="canvas.onTableDragStart"
          @fieldselect="canvas.onFieldSelect"
          @linkstart="canvas.onLinkStart"
          @resizestart="canvas.onResizeStart"
        />
      </template>
      <Note
        v-for="note in items.visibleNotes.value"
        :key="`note-${note.id}`"
        :note="note"
        :selected="canvas.selection.isSelected(String(note.id))"
      />
      <View
        v-for="view in items.visibleViews.value"
        :key="`view-${view.id}`"
        :view="view"
        :base-table-name="view.baseTableId ? diagram.tableById(view.baseTableId)?.name ?? '' : ''"
        :selected="canvas.selection.isSelected(String(view.id))"
      />
      <path
        v-if="canvas.linkPath.value"
        class="ddb-canvas__link-preview"
        :d="canvas.linkPath.value"
        data-testid="link-preview"
      />
      <rect
        v-if="canvas.selectionRect.value"
        class="ddb-canvas__selection-box"
        :x="canvas.selectionRect.value.x"
        :y="canvas.selectionRect.value.y"
        :width="canvas.selectionRect.value.width"
        :height="canvas.selectionRect.value.height"
        data-testid="selection-box"
      />
    </g>
  </svg>
  <ContextMenu
    :state="canvas.menu.value"
    @command="canvas.runMenuCommand"
  />
</template>
