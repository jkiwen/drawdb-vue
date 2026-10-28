<script setup lang="ts">
import { computed } from "vue";
import classes from "./ResizablePanel.module.css";

/**
 * A panel of the layout whose width the user adjusts.
 *
 * The panel is controlled: the parent owns the width and the collapsed
 * state and mirrors them into the settings of the user. The panel itself
 * only reports the gestures — a drag of the separator, a double click on
 * it and a click on the chevron handle that collapses the panel.
 */
defineOptions({ name: "DrawDBResizablePanel" });

const props = defineProps({
  /** The edge of the canvas the panel sits on. */
  side: { type: String as () => "left" | "right", required: true },
  /** The width of the expanded panel, in pixels. */
  width: { type: Number, required: true },
  /** The smallest width a drag can produce, in pixels. */
  minWidth: { type: Number, default: 200 },
  /** The largest width a drag can produce, in pixels. */
  maxWidth: { type: Number, default: 480 },
  /** The width a double click on the separator restores, in pixels. */
  defaultWidth: { type: Number, default: 280 },
  /** Whether the panel is collapsed to its handle. */
  collapsed: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (event: "update:width", width: number): void;
  (event: "update:collapsed", collapsed: boolean): void;
}>();

/** The inline width of the panel; a collapsed panel takes no space. */
const panelStyle = computed(() => ({
  width: `${props.collapsed ? 0 : props.width}px`,
}));

/**
 * The direction a drag moves the edge of the panel. Dragging away from the
 * canvas widens a left panel and shrinks a right one.
 */
const dragSign = computed(() => (props.side === "left" ? 1 : -1));

function clamp(value: number): number {
  return Math.min(props.maxWidth, Math.max(props.minWidth, value));
}

/** Starts a drag of the separator and follows the mouse until it is up. */
function startResize(event: MouseEvent): void {
  if (props.collapsed) return;
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = props.width;

  function onMove(move: MouseEvent): void {
    emit(
      "update:width",
      clamp(startWidth + dragSign.value * (move.clientX - startX)),
    );
  }

  function onUp(): void {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** Restores the default width of the panel. */
function resetWidth(): void {
  emit("update:width", props.defaultWidth);
}

/** Switches the panel between the expanded and the collapsed state. */
function toggleCollapsed(): void {
  emit("update:collapsed", !props.collapsed);
}
</script>

<template>
  <aside
    :class="[classes.panel, side === 'left' ? classes.left : classes.right, collapsed && classes.collapsed]"
    :style="panelStyle"
    :data-side="side"
    :aria-hidden="collapsed || undefined"
    data-testid="resizable-panel"
  >
    <div :class="classes.content">
      <slot />
    </div>
    <div
      v-if="!collapsed"
      :class="classes.resizer"
      role="separator"
      aria-orientation="vertical"
      data-testid="panel-resizer"
      @mousedown="startResize"
      @dblclick="resetWidth"
    />
    <button
      type="button"
      :class="classes.toggle"
      :aria-label="collapsed ? 'Expand panel' : 'Collapse panel'"
      :aria-expanded="!collapsed"
      data-testid="panel-collapse-toggle"
      @click="toggleCollapsed"
    >
      <svg
        :class="[classes.chevron, (side === 'right') !== collapsed && classes.chevronFlipped]"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
      >
        <path
          d="M10.5 3.5 6 8l4.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </aside>
</template>
