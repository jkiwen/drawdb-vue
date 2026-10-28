<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import {
  areaHoldsElement,
  elementBounds,
  heldByCollapsedArea,
} from "../../utils/elements.ts";
import {
  areaBounds,
  cardinalitySides,
  cardinalityText,
  relationshipPath,
  type Bounds,
  type EdgeAnchor,
} from "./geometry.ts";
import { renderEdgeAnchor, tableRenderBounds } from "./render-geometry.ts";
import { tableRenderModel } from "./render-model.ts";

defineOptions({ name: "DrawDBRelationshipNode" });

const props = defineProps({
  relationship: { type: Object as PropType<Relationship>, required: true },
  startTable: { type: Object as PropType<Table>, required: true },
  endTable: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
  /** The anchor of an end that folds with a collapsed area: the edge of its title bar. */
  startPoint: { type: Object as PropType<EdgeAnchor | null>, default: null },
  endPoint: { type: Object as PropType<EdgeAnchor | null>, default: null },
});

const diagram = useDiagramStore();
const viewState = useViewStateStore();
const toolbarScope = useToolbarScopeStore();

/**
 * The render models of the two tables.
 *
 * The relationship attaches to what the canvas draws, so the anchors and
 * the obstacles are measured with the render model of the current layer and
 * the display toggles (render-model.ts).
 */
// A table the toolbar collapsed on its own (ruling Q1) is measured with its
// own toggles, so the anchor follows the node the canvas actually draws.
const startModel = computed(() =>
  tableRenderModel(props.startTable, viewState.viewLayer, viewState.toggles, {
    overrides: toolbarScope.overrideFor(String(props.startTable.id)),
  }),
);
const endModel = computed(() =>
  tableRenderModel(props.endTable, viewState.viewLayer, viewState.toggles, {
    overrides: toolbarScope.overrideFor(String(props.endTable.id)),
  }),
);

function modelCenter(model: { width: number; height: number }, table: Table) {
  return {
    x: table.x + model.width / 2,
    y: table.y + model.height / 2,
  };
}

/**
 * The anchors of the relationship.
 *
 * An end a collapsed area holds anchors on the title bar of the area; every
 * other end anchors on the edge of its table nearest to the other end, on
 * the row of the field it points at — in both layers, the row is found by
 * the physical field the attribute maps to.
 */
const anchors = computed<{ start: EdgeAnchor; end: EdgeAnchor }>(() => {
  const startToward =
    props.endPoint ?? modelCenter(endModel.value, props.endTable);
  const endToward =
    props.startPoint ?? modelCenter(startModel.value, props.startTable);
  const start =
    props.startPoint ??
    renderEdgeAnchor(
      props.startTable,
      startModel.value,
      props.relationship.startFieldId,
      startToward,
    );
  const end =
    props.endPoint ??
    renderEdgeAnchor(
      props.endTable,
      endModel.value,
      props.relationship.endFieldId,
      endToward,
    );
  return { start, end };
});

/**
 * The boxes the line should not cross: the tables and the areas that hold
 * neither end of the relationship. A table hidden in a collapsed area leaves
 * no box on the canvas, so it is not an obstacle.
 */
const obstacles = computed<Bounds[]>(() => {
  const collapsed = diagram.areas.filter((area) => area.collapsed === true);
  const startId = String(props.startTable.id);
  const endId = String(props.endTable.id);
  const blocks: Bounds[] = [];
  for (const table of diagram.tables) {
    if (String(table.id) === startId || String(table.id) === endId) {
      continue;
    }
    if (table.hidden || heldByCollapsedArea(collapsed, elementBounds(table))) {
      continue;
    }
    blocks.push(
      tableRenderBounds(table, viewState.viewLayer, viewState.toggles),
    );
  }
  for (const area of diagram.areas) {
    if (area.collapsed === true) {
      continue;
    }
    if (
      areaHoldsElement(area, props.startTable) ||
      areaHoldsElement(area, props.endTable)
    ) {
      continue;
    }
    blocks.push(areaBounds(area));
  }
  return blocks;
});

const path = computed(() =>
  relationshipPath(anchors.value.start, anchors.value.end, {
    startSide: anchors.value.start.side,
    endSide: anchors.value.end.side,
    obstacles: obstacles.value,
  }),
);

const sides = computed(() => cardinalitySides(props.relationship.cardinality));

/**
 * The cardinality labels.
 *
 * The labels sit on the path, a little away from the tables, so that they do
 * not cover the fields they point at.
 */
const startLabel = computed(() => ({
  x: anchors.value.start.x,
  y: anchors.value.start.y,
  text: cardinalityText(sides.value.start),
}));

const endLabel = computed(() => ({
  x: anchors.value.end.x,
  y: anchors.value.end.y,
  text: cardinalityText(sides.value.end),
}));

const label = computed(() => {
  const { start, end } = anchors.value;
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 - 14,
  };
});
</script>

<template>
  <g
    class="ddb-canvas-relationship"
    :class="{ 'is-selected': selected }"
    :data-testid="`relationship-${relationship.id}`"
  >
    <path class="ddb-canvas-relationship__line" :d="path" fill="none" />
    <g
      v-for="marker in [startLabel, endLabel]"
      :key="marker.text"
      class="ddb-canvas-relationship__cardinality"
      :transform="`translate(${marker.x} ${marker.y})`"
    >
      <rect x="-9" y="-9" width="18" height="18" rx="9" ry="9" />
      <text x="0" y="0" text-anchor="middle" dominant-baseline="central">
        {{ marker.text }}
      </text>
    </g>
    <text
      v-if="relationship.name"
      class="ddb-canvas-relationship__label"
      :x="label.x"
      :y="label.y"
    >
      {{ relationship.name }}
    </text>
  </g>
</template>
