<script setup lang="ts">
import type { PropType } from "vue";
import type { TableId } from "@drawdb/core";

defineOptions({ name: "DrawDBResizeHandles" });

const props = defineProps({
  tableId: { type: [String, Number] as PropType<TableId>, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
});

const emit = defineEmits(["resizestart"]);

function onPointerDown(event: PointerEvent): void {
  event.stopPropagation();
  emit("resizestart", {
    tableId: props.tableId,
    width: props.width,
    height: props.height,
    event,
  });
}
</script>

<template>
  <div
    class="ddb-resize-handle"
    :style="{
      width: '12px',
      height: '12px',
    }"
    :data-testid="`resize-handle-${tableId}`"
    @pointerdown="onPointerDown"
  />
</template>
