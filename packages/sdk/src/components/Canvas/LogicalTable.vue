<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { LOGICAL_TABLE_HEIGHT, tableWidth } from "./geometry.ts";

defineOptions({ name: "DrawDBLogicalTableNode" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(["select", "dragstart"]);

const width = computed(() => tableWidth(props.table));

const bodyStyle = computed(() => {
  if (!props.table.color) {
    return {};
  }
  return { borderTop: `4px solid ${props.table.color}` };
});

function onPointerDown(event: PointerEvent): void {
  emit("dragstart", { id: props.table.id, event });
}
</script>

<template>
  <g
    class="ddb-logical-table"
    :class="{ 'is-selected': selected, 'is-locked': table.locked }"
    :transform="`translate(${table.x} ${table.y})`"
    :data-testid="`logical-table-${table.id}`"
    @pointerdown.stop="onPointerDown"
  >
    <foreignObject :width="width" :height="LOGICAL_TABLE_HEIGHT">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="ddb-logical-table__body"
        :class="{ 'is-selected': selected }"
        :style="bodyStyle"
      >
        <div class="ddb-logical-table__header">
          <span class="ddb-logical-table__name">{{ table.name }}</span>
        </div>
        <div v-if="table.comment" class="ddb-logical-table__comment">
          {{ table.comment }}
        </div>
      </div>
    </foreignObject>
  </g>
</template>
