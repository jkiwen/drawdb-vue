<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import {
  boundsCenter,
  cardinalitySides,
  cardinalityText,
  logicalEdgeAnchor,
  logicalTableBounds,
  relationshipPath,
  type EdgeAnchor,
} from "./geometry.ts";

defineOptions({ name: "DrawDBLogicalRelationshipNode" });

const props = defineProps({
  relationship: { type: Object as PropType<Relationship>, required: true },
  startTable: { type: Object as PropType<Table>, required: true },
  endTable: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
  /** The anchor of an end that folds with a collapsed area: the edge of its title bar. */
  startPoint: { type: Object as PropType<EdgeAnchor | null>, default: null },
  endPoint: { type: Object as PropType<EdgeAnchor | null>, default: null },
});

/**
 * The logical relationship.
 *
 * It connects the two entities and keeps the cardinality, but it does not
 * point at the fields the physical view attaches it to. An end a collapsed
 * area holds anchors on the title bar of the area.
 */
const anchors = computed<{ start: EdgeAnchor; end: EdgeAnchor }>(() => {
  const startToward = props.endPoint ?? boundsCenter(logicalTableBounds(props.endTable));
  const endToward = props.startPoint ?? boundsCenter(logicalTableBounds(props.startTable));
  return {
    start: props.startPoint ?? logicalEdgeAnchor(props.startTable, startToward),
    end: props.endPoint ?? logicalEdgeAnchor(props.endTable, endToward),
  };
});

const path = computed(() =>
  relationshipPath(anchors.value.start, anchors.value.end, {
    startSide: anchors.value.start.side,
    endSide: anchors.value.end.side,
  }),
);

const sides = computed(() => cardinalitySides(props.relationship.cardinality));

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
    class="ddb-logical-relationship"
    :class="{ 'is-selected': selected }"
    :data-testid="`logical-relationship-${relationship.id}`"
  >
    <path class="ddb-logical-relationship__line" :d="path" fill="none" />
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
      class="ddb-logical-relationship__label"
      :x="label.x"
      :y="label.y"
    >
      {{ relationship.name }}
    </text>
  </g>
</template>
