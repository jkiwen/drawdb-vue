<script setup lang="ts">
import type { PropType } from "vue";
import type { FieldId, TableId } from "@drawdb/core";

defineOptions({ name: "DrawDBFieldHandle" });

const props = defineProps({
  tableId: { type: [String, Number] as PropType<TableId>, required: true },
  fieldId: { type: [String, Number] as PropType<FieldId>, required: true },
});

const emit = defineEmits(["linkstart"]);

function onPointerDown(event: PointerEvent): void {
  event.stopPropagation();
  emit("linkstart", { tableId: props.tableId, fieldId: props.fieldId, event });
}
</script>

<template>
  <div
    class="ddb-field-handle"
    data-field-handle="true"
    :data-table-id="tableId"
    :data-field-id="fieldId"
    :data-testid="`field-handle-${tableId}-${fieldId}`"
    @pointerdown="onPointerDown"
  />
</template>
