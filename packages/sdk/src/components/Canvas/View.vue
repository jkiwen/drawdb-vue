<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { View } from "@drawdb/core";
import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH } from "./geometry.ts";

defineOptions({ name: "DrawDBViewNode" });

const props = defineProps({
  view: { type: Object as PropType<View>, required: true },
  baseTableName: { type: String, default: "" },
  selected: { type: Boolean, default: false },
});

const width = computed(() =>
  props.view.width && props.view.width > 0 ? props.view.width : DEFAULT_VIEW_WIDTH,
);

const stroke = computed(() => props.view.color ?? "#7c3aed");
</script>

<template>
  <g
    class="ddb-view"
    :class="{ 'is-selected': selected }"
    :transform="`translate(${view.x} ${view.y})`"
    :data-testid="`view-${view.id}`"
  >
    <rect
      class="ddb-view__rect"
      :width="width"
      :height="DEFAULT_VIEW_HEIGHT"
      fill="none"
      :stroke="stroke"
    />
    <text class="ddb-view__label" x="8" y="20">{{ view.name }}</text>
    <text v-if="baseTableName" class="ddb-view__base" x="8" y="38">
      {{ baseTableName }}
    </text>
  </g>
</template>
