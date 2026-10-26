<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import {
  areaHoldsElement,
  elementBounds,
  heldByCollapsedArea,
} from "../../utils/elements.ts";
import {
  areaBounds,
  boundsCenter,
  cardinalitySides,
  cardinalityText,
  logicalEdgeAnchor,
  logicalTableBounds,
  relationshipPath,
  tableBounds,
  tableEdgeAnchor,
  type Bounds,
  type EdgeAnchor,
} from "./geometry.ts";

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
const ui = useUIStore();

const logical = computed(() => ui.viewMode === "logical");

/**
 * The anchors of the relationship.
 *
 * An end a collapsed area holds anchors on the title bar of the area; every
 * other end anchors on the edge of its table nearest to the other end. The
 * physical view attaches the relationship to the fields it points at, the
 * logical view attaches it to the entities.
 */
const anchors = computed<{ start: EdgeAnchor; end: EdgeAnchor }>(() => {
  const boundsOf = logical.value ? logicalTableBounds : tableBounds;
  const startToward = props.endPoint ?? boundsCenter(boundsOf(props.endTable));
  const endToward = props.startPoint ?? boundsCenter(boundsOf(props.startTable));
  const start =
    props.startPoint ??
    (logical.value
      ? logicalEdgeAnchor(props.startTable, startToward)
      : tableEdgeAnchor(props.startTable, props.relationship.startFieldId, startToward));
  const end =
    props.endPoint ??
    (logical.value
      ? logicalEdgeAnchor(props.endTable, endToward)
      : tableEdgeAnchor(props.endTable, props.relationship.endFieldId, endToward));
  return { start, end };
});

/**
 * The boxes the line should not cross: the tables and the areas that hold
 * neither end of the relationship. A table hidden in a collapsed area leaves
 * no box on the canvas, so it is not an obstacle.
 */
const obstacles = computed<Bounds[]>(() => {
  if (logical.value) {
    return [];
  }
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
    blocks.push(tableBounds(table));
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
