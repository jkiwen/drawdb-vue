<script setup lang="ts">
/**
 * The zoom group (design 6.6): step out and in, a percent field, fit the
 * diagram, fit the selection, back to 100%, and the full screen. The zoom
 * steps stay inside the bounds of the ui store and grey at the edges; the
 * full screen probes the Fullscreen API and greys with the reason when it is
 * missing (an iframe without `allowfullscreen`, for example).
 */
import { computed, ref, watch } from "vue";
import { useFullscreen } from "../../composables/use-fullscreen.ts";
import { useZoomActions } from "../../composables/use-zoom-actions.ts";
import { t } from "../../i18n/index.ts";
import { MAX_ZOOM, MIN_ZOOM, useUIStore } from "../../stores/ui.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const ui = useUIStore();
const fullscreen = useFullscreen();
const zoomActions = useZoomActions();

// Keep the ui store in sync, so the canvas can react to the full screen too.
watch(fullscreen.isFullscreen, (value) => ui.setFullscreen(value));

const percent = computed(() => Math.round(ui.zoom * 100));

/** The draft of the percent field while the user types. */
const draft = ref(String(percent.value));

// Follow the store whenever the zoom changes from elsewhere (wheel, buttons).
watch(percent, (value) => {
  draft.value = String(value);
});

/** Applies the typed percentage; a broken value snaps back to the store. */
function commit(): void {
  const value = Number.parseInt(draft.value.replace("%", ""), 10);
  if (Number.isFinite(value)) {
    zoomActions.zoomToPercent(value);
  }
  draft.value = String(percent.value);
}

const fullscreenSupported =
  typeof document !== "undefined" &&
  typeof document.documentElement.requestFullscreen === "function";

const fullscreenTitle = computed(() =>
  t(fullscreenSupported ? "fullscreen_enter" : "fullscreen_unsupported"),
);

const hasSelection = computed(() => ui.selectedTableIds.length > 0);
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('zoom_group')" data-testid="toolbar-zoom">
    <ToolbarButton
      icon="zoom-out"
      :title="t('zoom_out_title')"
      testid="zoom-out-btn"
      :disabled="ui.zoom <= MIN_ZOOM"
      @click="ui.zoomOut()"
    />
    <input
      v-model="draft"
      :class="classes.zoomInput"
      :aria-label="t('zoom_percent')"
      data-testid="toolbar-zoom-input"
      inputmode="numeric"
      @change="commit"
      @blur="commit"
      @keydown.enter="commit"
    />
    <ToolbarButton
      icon="zoom-in"
      :title="t('zoom_in_title')"
      testid="zoom-in-btn"
      :disabled="ui.zoom >= MAX_ZOOM"
      @click="ui.zoomIn()"
    />
    <ToolbarButton
      icon="zoom-fit"
      :title="t('zoom_fit')"
      testid="toolbar-zoom-fit"
      @click="zoomActions.fitToContent()"
    />
    <ToolbarButton
      icon="zoom-selection"
      :title="t('zoom_selection')"
      testid="toolbar-zoom-selection"
      :disabled="!hasSelection"
      @click="zoomActions.fitToSelection()"
    />
    <ToolbarButton
      icon="zoom-reset"
      :title="t('zoom_reset')"
      testid="toolbar-zoom-reset"
      :disabled="ui.zoom === 1 && ui.scrollX === 0 && ui.scrollY === 0"
      @click="ui.resetView()"
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
