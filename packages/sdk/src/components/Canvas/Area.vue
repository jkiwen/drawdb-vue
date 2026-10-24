<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Area } from "@drawdb/core";
import type { ResizeState } from "./interactions/interaction-state.ts";

defineOptions({ name: "DrawDBAreaNode" });

const props = defineProps({
  area: { type: Object as PropType<Area>, required: true },
  selected: { type: Boolean, default: false },
  /**
   * The resize that runs on the canvas, or `null`. The area draws the size of
   * the drag that holds its corner before the release stores the size in the
   * diagram, the way a table follows the corner of its own resize.
   */
  resizing: { type: Object as PropType<ResizeState | null>, default: null },
});

const emit = defineEmits(["dragstart", "resizestart"]);

/** The side of the square that resizes the area, in canvas units. */
const RESIZE_HANDLE_SIZE = 12;

const fill = computed(() => props.area.color ?? "rgba(23, 94, 122, 0.08)");
const stroke = computed(() => props.area.color ?? "#175e7a");

/** The size of the drag that holds the corner of this area, or `null`. */
const drag = computed(() => {
  const resizing = props.resizing;
  if (!resizing || resizing.kind !== "area") {
    return null;
  }
  return String(resizing.id) === String(props.area.id) ? resizing : null;
});

/** The size the area is drawn with: the one of the drag, or the stored one. */
const size = computed(() => {
  const dragSize = drag.value;
  return {
    width: dragSize?.width ?? props.area.width,
    height: dragSize?.height ?? props.area.height,
  };
});

/** The corner of the area that the handle sits in. */
const handle = computed(() => ({
  x: size.value.width - RESIZE_HANDLE_SIZE,
  y: size.value.height - RESIZE_HANDLE_SIZE,
}));

/**
 * Selects the area and starts the drag that moves it.
 *
 * The event does not reach the canvas, which would clear the selection and
 * start a pan instead. A drag with the shift key is left to the canvas, which
 * draws the rectangle that selects several elements.
 */
function onPointerDown(event: PointerEvent): void {
  if (event.shiftKey) {
    return;
  }
  event.stopPropagation();
  emit("dragstart", { areaId: props.area.id, event });
}

/** Starts the resize of the area, the way the handle of a table does. */
function onResizeStart(event: PointerEvent): void {
  event.stopPropagation();
  emit("resizestart", {
    areaId: props.area.id,
    width: size.value.width,
    height: size.value.height,
    event,
  });
}
</script>

<template>
  <g
    class="ddb-area"
    :class="{ 'is-selected': selected }"
    :transform="`translate(${area.x} ${area.y})`"
    :data-testid="`area-${area.id}`"
    @pointerdown="onPointerDown"
  >
    <rect
      class="ddb-area__rect"
      :width="size.width"
      :height="size.height"
      :fill="fill"
      :stroke="stroke"
    />
    <text class="ddb-area__label" x="8" y="18">{{ area.name }}</text>
    <g
      class="ddb-area__resize"
      :data-testid="`area-resize-handle-${area.id}`"
      :transform="`translate(${handle.x} ${handle.y})`"
      @pointerdown="onResizeStart"
    >
      <rect
        class="ddb-area__resize-box"
        :width="RESIZE_HANDLE_SIZE"
        :height="RESIZE_HANDLE_SIZE"
      />
      <path class="ddb-area__resize-lines" d="M0 4 L4 0 M0 8 L8 0 M0 12 L12 0" />
    </g>
  </g>
</template>
