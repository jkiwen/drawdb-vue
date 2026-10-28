<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useCanvasEvents } from "../../composables/use-canvas-events.ts";
import { useZoomActions } from "../../composables/use-zoom-actions.ts";
import { useCanvasItems } from "../../composables/use-canvas-items.ts";
import Area from "./Area.vue";
import ContextMenu from "./ContextMenu.vue";
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
import "./canvas.css";

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

/**
 * The table of a relationship, or a placeholder when the diagram does not
 * have it. The two ends of a relationship are required by the component that
 * draws it, and a relationship that points at a missing table is malformed —
 * the drawer of the relationship stops at the placeholder, which sits at the
 * origin, instead of crashing the canvas.
 */
const tableOf = (id: number | string) =>
  diagram.tableById(id) ??
  ({
    id: 0,
    name: "",
    x: 0,
    y: 0,
    fields: [],
    logical: { id: "l_fallback", name: "", attributes: [] },
  } as const);

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

/**
 * Collapses an area to its title bar, or expands it back.
 *
 * The toggle is a property of the area (`Area.collapsed`), so it is written
 * through the store like every other change of the area: the history records
 * it, which makes it undoable, and the saved diagram carries it.
 */
function onAreaToggleCollapse({ areaId }: { areaId: string | number }): void {
  const area = diagram.areas.find(
    (item) => String(item.id) === String(areaId),
  );
  if (!area) {
    return;
  }
  diagram.updateArea(area.id, { collapsed: area.collapsed !== true });
}

/**
 * Locks an area, or unlocks it.
 *
 * The lock is written through the store like every other change of the area:
 * the history records it, which makes it undoable. A locked area refuses
 * every other change in the store, so the toggle is the one update that
 * still goes through.
 */
function onAreaToggleLock({ areaId }: { areaId: string | number }): void {
  const area = diagram.areas.find(
    (item) => String(item.id) === String(areaId),
  );
  if (!area) {
    return;
  }
  diagram.updateArea(area.id, { locked: area.locked !== true });
}

/**
 * The area whose details panel is open, or `null`.
 *
 * The openness is a state of the canvas and not of the diagram, so it is not
 * saved: a click on the empty canvas closes the panel again.
 */
const areaDetailsId = ref<string | null>(null);

function onAreaToggleDetails({ areaId }: { areaId: string | number }): void {
  const id = String(areaId);
  areaDetailsId.value = areaDetailsId.value === id ? null : id;
}

/** A click on the empty canvas closes the details panel of the area. */
function onCanvasPointerDown(event: PointerEvent): void {
  if (event.target === svgRef.value) {
    areaDetailsId.value = null;
  }
}

const zoomActions = useZoomActions();

/** Records the visible canvas so the zoom group can fit the diagram. */
function reportViewport(): void {
  const rect = svgRef.value?.getBoundingClientRect();
  zoomActions.setViewport({
    width: rect?.width ?? props.width,
    height: rect?.height ?? props.height,
  });
}

onMounted(() => {
  if (svgRef.value) {
    canvasEvents.attach(svgRef.value);
  }
  reportViewport();
  window.addEventListener("resize", reportViewport);
});

onBeforeUnmount(() => {
  canvasEvents.detach();
  window.removeEventListener("resize", reportViewport);
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
    @pointerdown="onCanvasPointerDown"
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
        :resizing="canvas.resize.resizing.value"
        :details-open="areaDetailsId === String(area.id)"
        :link-targets="items.collapsedAreaLinks.value.get(String(area.id)) ?? []"
        @dragstart="canvas.onAreaDragStart"
        @resizestart="canvas.onResizeStart"
        @togglecollapse="onAreaToggleCollapse"
        @togglelock="onAreaToggleLock"
        @toggledetails="onAreaToggleDetails"
      />
      <!--
        Both layers draw with the same nodes: the layer and the display
        toggles only change what a node shows (UI document section 6.1).
      -->
      <Relationship
        v-for="relationship in items.visibleRelationships.value"
        :key="`relationship-${relationship.id}`"
        :relationship="relationship"
        :start-table="tableOf(relationship.startTableId)"
        :end-table="tableOf(relationship.endTableId)"
        :selected="canvas.selection.isSelected(String(relationship.id))"
        :start-point="items.relationshipEndpoints.value.get(String(relationship.id))?.start ?? null"
        :end-point="items.relationshipEndpoints.value.get(String(relationship.id))?.end ?? null"
      />
      <Table
        v-for="table in items.visibleTables.value"
        :key="`table-${table.id}`"
        :table="table"
        :selected="canvas.selection.isSelected(String(table.id))"
        @dragstart="canvas.onTableDragStart"
        @fieldselect="canvas.onFieldSelect"
        @linkstart="canvas.onLinkStart"
        @resizestart="canvas.onResizeStart"
      />
      <Note
        v-for="note in items.visibleNotes.value"
        :key="`note-${note.id}`"
        :note="note"
        :selected="canvas.selection.isSelected(String(note.id))"
        :resizing="canvas.resize.resizing.value"
        @dragstart="canvas.onNoteDragStart"
        @resizestart="canvas.onResizeStart"
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
