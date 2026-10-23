<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import {
  cardinalityMarker,
  cardinalitySides,
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

const startDirection = computed(() =>
  anchors.value.end.x >= anchors.value.start.x ? "right" : "left",
);

const endDirection = computed(() =>
  anchors.value.end.x >= anchors.value.start.x ? "left" : "right",
);

const startMarker = computed(() =>
  cardinalityMarker(sides.value.start, anchors.value.start, startDirection.value),
);

const endMarker = computed(() =>
  cardinalityMarker(sides.value.end, anchors.value.end, endDirection.value),
);

const label = computed(() => {
  const { start, end } = anchors.value;
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 - 6,
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
    <path class="ddb-logical-relationship__marker" :d="startMarker" fill="none" />
    <path class="ddb-logical-relationship__marker" :d="endMarker" fill="none" />
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
