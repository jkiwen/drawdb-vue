<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { tableBounds } from "./geometry.ts";

defineOptions({ name: "DrawDBMinimap" });

const props = defineProps({
  tables: { type: Array as PropType<Table[]>, default: () => [] },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 140 },
});

/** The part of the world that the diagram occupies. */
const world = computed(() => {
  if (!props.tables.length) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  const bounds = props.tables.map((table) => tableBounds(table));
  return {
    minX: Math.min(...bounds.map((item) => item.minX)),
    minY: Math.min(...bounds.map((item) => item.minY)),
    maxX: Math.max(...bounds.map((item) => item.maxX)),
    maxY: Math.max(...bounds.map((item) => item.maxY)),
  };
});

/** The factor between the world and the minimap. */
const scale = computed(() => {
  const width = Math.max(1, world.value.maxX - world.value.minX);
  const height = Math.max(1, world.value.maxY - world.value.minY);
  return Math.min(props.width / width, props.height / height);
});

/** The rectangle of a table on the minimap. */
function rectOf(table: Table) {
  const bounds = tableBounds(table);
  return {
    x: (bounds.minX - world.value.minX) * scale.value,
    y: (bounds.minY - world.value.minY) * scale.value,
    width: Math.max(2, (bounds.maxX - bounds.minX) * scale.value),
    height: Math.max(2, (bounds.maxY - bounds.minY) * scale.value),
  };
}
</script>

<template>
  <svg
    class="ddb-minimap"
    :width="width"
    :height="height"
    data-testid="minimap"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      v-for="table in tables"
      :key="table.id"
      class="ddb-minimap__table"
      :x="rectOf(table).x"
      :y="rectOf(table).y"
      :width="rectOf(table).width"
      :height="rectOf(table).height"
      :data-testid="`minimap-table-${table.id}`"
    />
  </svg>
</template>
