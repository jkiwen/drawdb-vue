<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Area } from "@drawdb/core";

defineOptions({ name: "DrawDBAreaNode" });

const props = defineProps({
  area: { type: Object as PropType<Area>, required: true },
  selected: { type: Boolean, default: false },
});

const fill = computed(() => props.area.color ?? "rgba(23, 94, 122, 0.08)");
const stroke = computed(() => props.area.color ?? "#175e7a");
</script>

<template>
  <g
    class="ddb-area"
    :class="{ 'is-selected': selected }"
    :transform="`translate(${area.x} ${area.y})`"
    :data-testid="`area-${area.id}`"
  >
    <rect
      class="ddb-area__rect"
      :width="area.width"
      :height="area.height"
      :fill="fill"
      :stroke="stroke"
    />
    <text class="ddb-area__label" x="8" y="18">{{ area.name }}</text>
  </g>
</template>
