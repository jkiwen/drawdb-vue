<script setup lang="ts">
/**
 * The style of a table, on the canvas itself: the colour of the band above
 * its name.
 *
 * The indices and the unique constraints used to be edited here too; they are
 * objects with names and ordered columns now (P2'), so they live in the panel
 * of the editor and this block only keeps the style (review of 2026-10-29).
 */
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import ColorPicker from "../EditPanel/ColorPicker.vue";

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  locked: { type: Boolean, default: false },
});

defineOptions({ name: "DrawDBTableDetails" });

const diagram = useDiagramStore();

const locked = computed(() => props.locked || props.table.locked === true);

function commitColor(color: string): void {
  if (locked.value) return;
  diagram.updateTable(props.table.id, { color: color === "" ? undefined : color });
}
</script>

<template>
  <div class="ddb-table__details" @pointerdown.stop>
    <div class="ddb-table__details-color-row">
      <span class="ddb-table__details-label">Color</span>
      <ColorPicker
        :value="table.color ?? ''"
        :disabled="locked"
        :testid="`table-color-${table.id}`"
        @update:value="commitColor"
      />
    </div>
  </div>
</template>
