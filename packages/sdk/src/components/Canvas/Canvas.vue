<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useCanvasEvents } from "../../composables/use-canvas-events.ts";
import { useDrag } from "../../composables/use-drag.ts";
import { useSelection } from "../../composables/use-selection.ts";
import { useViewport } from "../../composables/use-viewport.ts";
import Area from "./Area.vue";
import Note from "./Note.vue";
import Relationship from "./Relationship.vue";
import Table from "./Table.vue";
import View from "./View.vue";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  areaBounds,
  filterVisible,
  noteBounds,
  relationshipBounds,
  tableBounds,
  viewBounds,
  visibleWorldBounds,
} from "./geometry.ts";

defineOptions({ name: "DrawDBCanvas" });

const props = withDefaults(
  defineProps<{
    /** Width of the viewport, used to cull the elements that are off screen. */
    width?: number;
    /** Height of the viewport, used to cull the elements that are off screen. */
    height?: number;
    /** Size of the grid the elements snap to while they are dragged. */
    gridSize?: number;
  }>(),
  {
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
    gridSize: DEFAULT_GRID_SIZE,
  },
);

const diagram = useDiagramStore();
const ui = useUIStore();
const selection = useSelection();
const drag = useDrag();
const viewport = useViewport();

const svgRef = ref<SVGSVGElement | null>(null);

let panOrigin: { x: number; y: number } | null = null;
let panScroll: { x: number; y: number } | null = null;

/** The part of the diagram that is currently visible. */
const world = computed(() =>
  visibleWorldBounds(
    ui.scrollX,
    ui.scrollY,
    ui.zoom,
    props.width,
    props.height,
  ),
);

const transform = computed(
  () =>
    `translate(${-ui.scrollX * ui.zoom} ${-ui.scrollY * ui.zoom}) scale(${ui.zoom})`,
);

const visibleAreas = computed(() =>
  filterVisible(diagram.areas, areaBounds, world.value),
);

const visibleNotes = computed(() =>
  filterVisible(diagram.notes, noteBounds, world.value),
);

const visibleViews = computed(() =>
  filterVisible(diagram.views, viewBounds, world.value),
);

const visibleTables = computed(() =>
  filterVisible(
    diagram.tables.filter((table) => !table.hidden),
    tableBounds,
    world.value,
  ),
);

const visibleRelationships = computed(() =>
  diagram.relationships.filter((relationship) => {
    const startTable = diagram.tableById(relationship.startTableId);
    const endTable = diagram.tableById(relationship.endTableId);

    if (!startTable || !endTable) {
      return false;
    }

    const bounds = relationshipBounds(relationship, startTable, endTable);
    return (
      bounds.minX <= world.value.maxX &&
      bounds.maxX >= world.value.minX &&
      bounds.minY <= world.value.maxY &&
      bounds.maxY >= world.value.minY
    );
  }),
);

function canvasRect(): { left: number; top: number; width: number; height: number } {
  const rect = svgRef.value?.getBoundingClientRect();
  return {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    width: rect?.width ?? props.width,
    height: rect?.height ?? props.height,
  };
}

function onTableDragStart(payload: { id: string; event: PointerEvent }): void {
  const { id, event } = payload;
  const additive = event.shiftKey;

  if (!selection.isSelected(id)) {
    selection.select(id, { additive, kind: "table" });
  }

  const ids = selection.selectedTables.value;
  const table = diagram.tableById(id);

  if (!table) {
    return;
  }

  const point = viewport.toCanvasPoint(
    event.clientX,
    event.clientY,
    canvasRect(),
  );

  drag.beginDrag(point, ids, {
    snapToGrid: ui.snapToGrid,
    gridSize: props.gridSize,
  });
}

function onFieldSelect(payload: {
  tableId: string;
  fieldId: string;
  event: PointerEvent;
}): void {
  ui.selectField(payload.tableId, payload.fieldId, payload.event.shiftKey);
}

function commitDrag(): void {
  const result = drag.endDrag();

  if (!result) {
    return;
  }

  for (const id of result.ids) {
    const table = diagram.tableById(id);
    if (!table) {
      continue;
    }
    diagram.updateTable(id, {
      x: table.x + result.delta.x,
      y: table.y + result.delta.y,
    });
  }
}

const canvasEvents = useCanvasEvents({
  onPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    selection.clear();
    panOrigin = { x: event.clientX, y: event.clientY };
    panScroll = { x: ui.scrollX, y: ui.scrollY };
  },
  onPointerMove(event: PointerEvent) {
    if (drag.dragState.active) {
      drag.updateDrag(
        viewport.toCanvasPoint(event.clientX, event.clientY, canvasRect()),
      );
      return;
    }

    if (panOrigin && panScroll) {
      const dx = (event.clientX - panOrigin.x) / viewport.zoom.value;
      const dy = (event.clientY - panOrigin.y) / viewport.zoom.value;
      ui.scrollX = panScroll.x - dx;
      ui.scrollY = panScroll.y - dy;
    }
  },
  onPointerUp() {
    if (drag.dragState.active) {
      commitDrag();
    }
    panOrigin = null;
    panScroll = null;
  },
  onWheel(event: WheelEvent) {
    ui.setZoom(ui.zoom - event.deltaY * 0.001);
  },
});

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
    <g class="ddb-canvas__content" :transform="transform" data-testid="canvas-content">
      <Area
        v-for="area in visibleAreas"
        :key="`area-${area.id}`"
        :area="area"
        :selected="selection.isSelected(String(area.id))"
      />
      <Relationship
        v-for="relationship in visibleRelationships"
        :key="`relationship-${relationship.id}`"
        :relationship="relationship"
        :start-table="diagram.tableById(relationship.startTableId)!"
        :end-table="diagram.tableById(relationship.endTableId)!"
        :selected="selection.isSelected(String(relationship.id))"
      />
      <Table
        v-for="table in visibleTables"
        :key="`table-${table.id}`"
        :table="table"
        :selected="selection.isSelected(String(table.id))"
        @dragstart="onTableDragStart"
        @fieldselect="onFieldSelect"
      />
      <Note
        v-for="note in visibleNotes"
        :key="`note-${note.id}`"
        :note="note"
        :selected="selection.isSelected(String(note.id))"
      />
      <View
        v-for="view in visibleViews"
        :key="`view-${view.id}`"
        :view="view"
        :base-table-name="view.baseTableId ? diagram.tableById(view.baseTableId)?.name ?? '' : ''"
        :selected="selection.isSelected(String(view.id))"
      />
    </g>
  </svg>
</template>
