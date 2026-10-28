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
import type { PropType } from "vue";
import type { ToolbarGroupId } from "../../types/sdk-options.ts";

const props = defineProps({
  /**
   * The groups the toolbar shows, in the fixed order of the design. An
   * absent prop shows every group (Q13: everything on by default).
   */
  groups: { type: Array as PropType<ToolbarGroupId[]>, default: undefined },
});

const emit = defineEmits<{ menu: [key: string] }>();

/** Whether a group is part of the selection the host kept. */
function shows(group: ToolbarGroupId): boolean {
  return props.groups === undefined || props.groups.includes(group);
}
</script>

<template>
  <div :class="classes.toolbar" role="toolbar" aria-label="Canvas toolbar" data-testid="canvas-toolbar">
    <ToolbarScopeIndicator />
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('displayMode')"><ToolbarDisplayMode /></template>
    <template v-if="shows('viewToggles')"><ToolbarViewToggles /></template>
    <!-- TODO(Task 4 follow-up): the layout group (Grid/Flow/Auto, 6.3) and the
         alignment group (6.5) land with their commands; they are out of this
         iteration. -->
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('viewLayer')"><ToolbarViewLayer /></template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('zoom')"><ToolbarZoom /></template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('undoRedo')"><ToolbarUndoRedo /></template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('file')"><ToolbarFile @menu="(key: string) => emit('menu', key)" /></template>
  </div>
</template>
