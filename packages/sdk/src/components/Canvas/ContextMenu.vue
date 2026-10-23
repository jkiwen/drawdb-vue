<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import { NDropdown } from "naive-ui";
import type { DropdownOption } from "naive-ui";
import type { CanvasContextMenuState } from "./interactions/use-context-menu.ts";

defineOptions({ name: "DrawDBContextMenu" });

const props = defineProps({
  state: { type: Object as PropType<CanvasContextMenuState | null>, default: null },
});

const emit = defineEmits(["command"]);

/** The entries of the menu, according to the object it was opened on. */
const options = computed<DropdownOption[]>(() => {
  const target = props.state?.target;
  if (!target) {
    return [];
  }

  if (target.kind === "table") {
    return [
      { label: "Toggle the lock", key: "table:toggle-lock" },
      { label: "Delete the table", key: "table:delete" },
    ];
  }

  if (target.kind === "field") {
    return [
      { label: "Primary key", key: "field:primary" },
      { label: "Not null", key: "field:not-null" },
      { label: "Unique", key: "field:unique" },
      { label: "Delete the field", key: "field:delete" },
    ];
  }

  return [
    { label: "Add a table", key: "canvas:add-table" },
    { label: "Arrange the tables", key: "canvas:auto-arrange" },
  ];
});

function onSelect(key: string): void {
  emit("command", key);
}
</script>

<template>
  <NDropdown
    v-if="state"
    trigger="manual"
    placement="bottom-start"
    :x="state.x"
    :y="state.y"
    :options="options"
    :show="true"
    data-testid="context-menu"
    @select="onSelect"
  />
</template>
