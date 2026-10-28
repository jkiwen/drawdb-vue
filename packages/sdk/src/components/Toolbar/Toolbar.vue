<script setup lang="ts">
/**
 * The toolbar of the canvas (plan Task 4, design 6.0): icon buttons with a
 * tooltip (name and shortcut), grouped by theme, with the permanent scope
 * indicator of ruling Q1 on the left. The file group emits the menu keys of
 * the editor-menu protocol, so the host keeps owning New/Open/Save.
 */
import ToolbarDisplayMode from "./ToolbarDisplayMode.vue";
import ToolbarFile from "./ToolbarFile.vue";
import ToolbarScopeIndicator from "./ToolbarScopeIndicator.vue";
import ToolbarUndoRedo from "./ToolbarUndoRedo.vue";
import ToolbarViewLayer from "./ToolbarViewLayer.vue";
import ToolbarViewToggles from "./ToolbarViewToggles.vue";
import ToolbarZoom from "./ToolbarZoom.vue";
import classes from "./toolbar.module.css";

const emit = defineEmits<{ menu: [key: string] }>();
</script>

<template>
  <div :class="classes.toolbar" role="toolbar" aria-label="Canvas toolbar" data-testid="toolbar">
    <ToolbarScopeIndicator />
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarDisplayMode />
    <ToolbarViewToggles />
    <!-- TODO(Task 4 follow-up): the layout group (Grid/Flow/Auto, 6.3) and the
         alignment group (6.5) land with their commands; they are out of this
         iteration. -->
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarViewLayer />
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarZoom />
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarUndoRedo />
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarFile @menu="(key: string) => emit('menu', key)" />
  </div>
</template>
