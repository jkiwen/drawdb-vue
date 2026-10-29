<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import type { PropType } from "vue";
import { NDropdown } from "naive-ui";
import type { DropdownOption } from "naive-ui";
import type { CanvasContextMenuState } from "./interactions/use-context-menu.ts";

defineOptions({ name: "DrawDBContextMenu" });

const props = defineProps({
  state: { type: Object as PropType<CanvasContextMenuState | null>, default: null },
});

const emit = defineEmits(["command", "close"]);

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

/**
 * The menu of the right button is opened by the canvas, which also owns the
 * pointer handling, so a click anywhere else closes it (issue 9: before, the
 * menu stayed on the screen until a command was chosen).
 */
function onOutside(): void {
  emit("close");
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}

/**
 * A press anywhere but on the menu itself closes it.
 *
 * The dropdown of Naive UI answers a press outside of it, but a dialog covers
 * the page with a mask that swallows the press before the dropdown sees it, so
 * the menu of the canvas stayed on top of the dialog (bug report of
 * 2026-10-29). The press is watched in the capture phase, before the mask of
 * the dialog can stop it.
 */
function onPointerDown(event: PointerEvent): void {
  if (!props.state) {
    return;
  }
  const target = event.target;
  if (target instanceof Element && target.closest(".n-dropdown, [data-testid='context-menu']")) {
    return;
  }
  emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("pointerdown", onPointerDown, true);
});
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
    :on-clickoutside="onOutside"
    data-testid="context-menu"
    @select="onSelect"
  />
</template>
