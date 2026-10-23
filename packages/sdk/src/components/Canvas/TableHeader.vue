<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { TABLE_COLOR_STRIP_HEIGHT } from "./geometry.ts";

defineOptions({ name: "DrawDBTableHeader" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
});

const headerStyle = computed(() => {
  if (!props.table.color) {
    return {};
  }
  return { borderTopColor: props.table.color };
});
</script>

<template>
  <div
    class="ddb-table__header"
    :class="{ 'is-selected': selected }"
    :style="headerStyle"
    :data-testid="`table-header-${table.id}`"
  >
    <span class="ddb-table__name">{{ table.name }}</span>
    <span v-if="table.comment" class="ddb-table__comment">{{ table.comment }}</span>
    <span
      v-if="table.color"
      class="ddb-table__color-strip"
      :style="{ height: `${TABLE_COLOR_STRIP_HEIGHT}px` }"
    />
  </div>
</template>
