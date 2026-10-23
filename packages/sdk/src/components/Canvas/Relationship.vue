<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Relationship, Table } from "@drawdb/core";
import { useUIStore } from "../../stores/ui.ts";
import {
  cardinalityMarker,
  cardinalitySides,
  logicalRelationshipAnchors,
  relationshipAnchors,
  relationshipPath,
} from "./geometry.ts";

defineOptions({ name: "DrawDBRelationshipNode" });

const props = defineProps({
  relationship: { type: Object as PropType<Relationship>, required: true },
  startTable: { type: Object as PropType<Table>, required: true },
  endTable: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
});

const ui = useUIStore();

/**
 * The anchors of the relationship.
 *
 * The physical view attaches the relationship to the fields it points at, the
 * logical view attaches it to the entities.
 */
const anchors = computed(() =>
  ui.viewMode === "logical"
    ? logicalRelationshipAnchors(props.startTable, props.endTable)
    : relationshipAnchors(props.relationship, props.startTable, props.endTable),
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
    class="ddb-relationship"
    :class="{ 'is-selected': selected }"
    :data-testid="`relationship-${relationship.id}`"
  >
    <path class="ddb-relationship__line" :d="path" fill="none" />
    <path class="ddb-relationship__marker" :d="startMarker" fill="none" />
    <path class="ddb-relationship__marker" :d="endMarker" fill="none" />
    <text
      v-if="relationship.name"
      class="ddb-relationship__label"
      :x="label.x"
      :y="label.y"
    >
      {{ relationship.name }}
    </text>
  </g>
</template>
