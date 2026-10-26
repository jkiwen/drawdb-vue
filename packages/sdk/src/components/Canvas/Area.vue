<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Area } from "@drawdb/core";
import { DEFAULT_AREA_OPACITY, withOpacity } from "../../utils/elements.ts";
import AreaDetails from "./AreaDetails.vue";
import AreaLinkBadge from "./AreaLinkBadge.vue";
import { COLLAPSED_AREA_HEIGHT } from "./geometry.ts";
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
  /** Whether the details panel of the area is open. */
  detailsOpen: { type: Boolean, default: false },
  /**
   * The tables outside of the collapsed area that a relationship anchored on
   * the title bar points at, in the coordinates of the canvas. The badge on
   * the title bar counts them and the hover draws a dashed line to each of
   * them.
   */
  linkTargets: {
    type: Array as PropType<Array<{ x: number; y: number }>>,
    default: () => [],
  },
});
const emit = defineEmits([
  "dragstart",
  "resizestart",
  "togglecollapse",
  "togglelock",
  "toggledetails",
]);

/** The side of the square that resizes the area, in canvas units. */
const RESIZE_HANDLE_SIZE = 12;

/** The side of the square a button of the title bar sits in. */
const BUTTON_SIZE = 20;
/** The color of the stroke and, softened, of the fill. */
const color = computed(() => props.area.color ?? "#175e7a");

/** The fill: the color softened by the opacity; the stroke keeps it full. */
const fill = computed(() =>
  withOpacity(color.value, props.area.opacity ?? DEFAULT_AREA_OPACITY),
);
const stroke = computed(() => color.value);

/** Whether the area is collapsed to its title bar. */
const collapsed = computed(() => props.area.collapsed === true);

/** Whether the area is locked, so that it cannot be changed any more. */
const locked = computed(() => props.area.locked === true);

/** The size of the drag that holds the corner of this area, or `null`. */
const drag = computed(() => {
  const resizing = props.resizing;
  if (!resizing || resizing.kind !== "area") {
    return null;
  }
  return String(resizing.id) === String(props.area.id) ? resizing : null;
});

/**
 * The size the area is drawn with: the one of the drag, or the stored one. A
 * collapsed area keeps its stored size and draws the title bar only, so the
 * expand brings back the size the area had before it was collapsed.
 */
const size = computed(() => {
  const dragSize = drag.value;
  return {
    width: dragSize?.width ?? props.area.width,
    height: collapsed.value
      ? COLLAPSED_AREA_HEIGHT
      : (dragSize?.height ?? props.area.height),
  };
});

/** The corner of the area that the handle sits in. */
const handle = computed(() => ({
  x: size.value.width - RESIZE_HANDLE_SIZE,
  y: size.value.height - RESIZE_HANDLE_SIZE,
}));

/**
 * The places of the buttons of the title bar, from the right edge to the
 * left: the collapse toggle, then the details, then the lock.
 */
const toggle = computed(() => ({
  x: size.value.width - BUTTON_SIZE - 4,
  y: 4,
}));
const detailsButton = computed(() => ({ x: toggle.value.x - BUTTON_SIZE - 4, y: 4 }));
const lockButton = computed(() => ({
  x: detailsButton.value.x - BUTTON_SIZE - 4,
  y: 4,
}));

/**
 * The shackle of the padlock: closed on a locked area, open on an unlocked
 * one, so that the icon itself tells the state of the lock.
 */
const shackle = computed(() =>
  locked.value ? "M7 9 V7 a3 3 0 0 1 6 0 V9" : "M7 9 V7 a3 3 0 0 1 6 0",
);

/**
 * The lines from the title bar to the tables outside of the collapsed area,
 * in the coordinates of the area.
 */
const linkLines = computed(() =>
  props.linkTargets.map((target) => ({
    x1: 8,
    y1: COLLAPSED_AREA_HEIGHT / 2,
    x2: target.x - props.area.x,
    y2: target.y - props.area.y,
  })),
);
/**
 * Selects the area and starts the drag that moves it.
 *
 * The event does not reach the canvas, which would clear the selection and
 * start a pan instead. A drag with the shift key is left to the canvas, which
 * draws the rectangle that selects several elements. A locked area is
 * selected by the click but does not move.
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
  if (locked.value) {
    return;
  }
  event.stopPropagation();
  emit("resizestart", {
    areaId: props.area.id,
    width: size.value.width,
    height: size.value.height,
    event,
  });
}

/**
 * Collapses the area to its title bar, or expands it back.
 *
 * The press is stopped so that it neither starts the drag of the area nor
 * reaches the canvas, the way the press on the resize handle is.
 */
function onToggle(event: MouseEvent): void {
  event.stopPropagation();
  emit("togglecollapse", { areaId: props.area.id });
}
/** Locks the area, or unlocks it, the way the lock of a note does. */
function onToggleLock(event: MouseEvent): void {
  event.stopPropagation();
  emit("togglelock", { areaId: props.area.id });
}
/** Opens the details panel of the area, or closes it. */
function onToggleDetails(event?: MouseEvent): void {
  event?.stopPropagation();
  emit("toggledetails", { areaId: props.area.id });
}
</script>

<template>
  <g
    class="ddb-area"
    :class="{
      'is-selected': selected,
      'is-collapsed': collapsed,
      'is-locked': locked,
    }"
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
      @pointerdown="onPointerDown"
    />
    <text
      class="ddb-area__label"
      x="8"
      y="18"
      @pointerdown="onPointerDown"
      >{{ area.name }}</text
    >
    <AreaLinkBadge
      v-if="collapsed && linkTargets.length > 0"
      :count="linkTargets.length"
      :lines="linkLines"
      :data-testid="`area-link-badge-${area.id}`"
    />
    <g
      class="ddb-area__button ddb-area__toggle"
      :transform="`translate(${toggle.x} ${toggle.y})`"
      :data-testid="`area-toggle-${area.id}`"
      role="button"
      :aria-label="collapsed ? 'Expand the area' : 'Collapse the area'"
      @pointerdown.stop      @click="onToggle"
    >
      <title>{{ collapsed ? "Expand the area" : "Collapse the area" }}</title>
      <rect
        class="ddb-area__button-box ddb-area__toggle-box"
        :width="BUTTON_SIZE"
        :height="BUTTON_SIZE"
      />
      <path class="ddb-area__toggle-chevron" d="M5 7 L10 12 L15 7" />
    </g>

    <g
      class="ddb-area__button ddb-area__details-toggle"
      :class="{ 'is-open': detailsOpen }"
      :transform="`translate(${detailsButton.x} ${detailsButton.y})`"
      :data-testid="`area-details-toggle-${area.id}`"
      role="button"
      aria-label="Edit the details of the area"
      @pointerdown.stop
      @click="onToggleDetails"
    >
      <title>Edit the details of the area</title>
      <rect
        class="ddb-area__button-box"
        :width="BUTTON_SIZE"
        :height="BUTTON_SIZE"
      />
      <path
        class="ddb-area__button-icon"
        d="M11.5 4.5 L15.5 8.5 L8.5 15.5 L4.5 16.5 L5.5 12.5 Z"
      />
    </g>

    <g
      class="ddb-area__button ddb-area__lock-toggle"
      :transform="`translate(${lockButton.x} ${lockButton.y})`"
      :data-testid="`area-lock-toggle-${area.id}`"
      role="button"
      :aria-label="locked ? 'Unlock the area' : 'Lock the area'"
      @pointerdown.stop
      @click="onToggleLock"
    >
      <title>{{ locked ? "Unlock the area" : "Lock the area" }}</title>
      <rect
        class="ddb-area__button-box"
        :width="BUTTON_SIZE"
        :height="BUTTON_SIZE"
      />
      <rect class="ddb-area__button-icon" x="5.5" y="9" width="9" height="7" rx="1" />
      <path class="ddb-area__button-icon" :d="shackle" />
    </g>
    <g
      v-if="!collapsed && !locked"
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

  <!--
    The details panel hangs below the area and is drawn outside of the group
    of the area, so that the press inside it neither starts the drag of the
    area nor reaches the canvas. A panel inside the group of the area would
    move the area with it, and the close button of the panel would never see
    the click, because the area would move away under the pointer.
  -->
  <AreaDetails
    v-if="detailsOpen"
    :area="area"
    :locked="locked"
    :x="area.x"
    :y="area.y + size.height"
    @close="onToggleDetails"
  />
</template>