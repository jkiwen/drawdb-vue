<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import {
  cardinalitySides,
  cardinalityText,
  logicalRelationshipAnchors,
  relationshipPath,
} from "./geometry.ts";

defineOptions({ name: "DrawDBLogicalRelationshipNode" });

const props = defineProps({
  relationship: { type: Object as PropType<Relationship>, required: true },
  startTable: { type: Object as PropType<Table>, required: true },
  endTable: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
});

/**
 * The logical relationship.
 *
 * It connects the two entities and keeps the cardinality, but it does not
 * point at the fields the physical view attaches it to.
 */
const anchors = computed(() =>
  logicalRelationshipAnchors(props.startTable, props.endTable),
);

const path = computed(() =>
  relationshipPath(anchors.value.start, anchors.value.end),
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
      class="ddb-relationship__cardinality"
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
