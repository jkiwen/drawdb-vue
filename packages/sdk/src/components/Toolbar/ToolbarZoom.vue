<script setup lang="ts">
/**
 * The zoom and the full screen (design 6.6). The zoom steps stay inside the
 * bounds of the ui store and the buttons grey at the edges; the full screen
 * probes the Fullscreen API and greys with the reason when it is missing
 * (an iframe without `allowfullscreen`, for example).
 */
import { computed, watch } from "vue";
import { useFullscreen } from "../../composables/use-fullscreen.ts";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useUIStore,
} from "../../stores/ui.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const ui = useUIStore();
const fullscreen = useFullscreen();

// Keep the ui store in sync, so the canvas can react to the full screen too.
watch(fullscreen.isFullscreen, (value) => ui.setFullscreen(value));

const zoomLabel = computed(() => `${Math.round(ui.zoom * 100)}%`);

const fullscreenSupported =
  typeof document !== "undefined" &&
  typeof document.documentElement.requestFullscreen === "function";

// TODO(i18n Task 7): the titles move into the locale files.
const fullscreenTitle = fullscreenSupported
  ? "Full screen (F11)"
  : "Full screen is not supported in this browser or context";
</script>

<template>
  <div :class="classes.group" role="group" aria-label="Zoom" data-testid="toolbar-zoom">
    <ToolbarButton
      icon="zoom-out"
      title="Zoom out (Ctrl+-)"
      testid="toolbar-zoom-out"
      :disabled="ui.zoom <= MIN_ZOOM"
      @click="ui.zoomOut()"
    />
    <span :class="classes.zoomLabel" data-testid="toolbar-zoom-label">{{ zoomLabel }}</span>
    <ToolbarButton
      icon="zoom-in"
      title="Zoom in (Ctrl++)"
      testid="toolbar-zoom-in"
      :disabled="ui.zoom >= MAX_ZOOM"
      @click="ui.zoomIn()"
    />
    <ToolbarButton
      icon="fullscreen"
      :title="fullscreenTitle"
      testid="toolbar-fullscreen"
      :active="fullscreen.isFullscreen.value"
      :disabled="!fullscreenSupported"
      @click="fullscreen.toggle()"
    />
  </div>
</template>
