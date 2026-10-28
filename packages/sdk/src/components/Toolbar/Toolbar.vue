<script setup lang="ts">
/**
 * The toolbar of the canvas (plan Task 4, design 6.0): icon buttons with a
 * tooltip (name and shortcut), grouped by theme, with the permanent scope
 * indicator of ruling Q1 on the left. The string groups — layout, align, file
 * and config — emit the menu keys of the editor-menu protocol or act on the
 * stores directly; the host keeps owning New/Open/Save.
 */
import { t } from "../../i18n/index.ts";
import ToolbarAlign from "./ToolbarAlign.vue";
import ToolbarCanvasView from "./ToolbarCanvasView.vue";
import ToolbarConfig from "./ToolbarConfig.vue";
import ToolbarCreate from "./ToolbarCreate.vue";
import ToolbarDisplayMode from "./ToolbarDisplayMode.vue";
import ToolbarFile from "./ToolbarFile.vue";
import ToolbarLayout from "./ToolbarLayout.vue";
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
  <div :class="classes.toolbar" role="toolbar" :aria-label="t('toolbar_canvas')" data-testid="canvas-toolbar">
    <ToolbarScopeIndicator />
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('create')">
      <ToolbarCreate />
      <span :class="classes.divider" aria-hidden="true" />
    </template>
    <template v-if="shows('displayMode')"><ToolbarDisplayMode /></template>
    <template v-if="shows('viewToggles')"><ToolbarViewToggles /></template>
    <template v-if="shows('layout')">
      <span :class="classes.divider" aria-hidden="true" />
      <ToolbarLayout />
    </template>
    <template v-if="shows('align')">
      <span :class="classes.divider" aria-hidden="true" />
      <ToolbarAlign />
    </template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('viewLayer')"><ToolbarViewLayer /></template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('zoom')"><ToolbarZoom /></template>
    <template v-if="shows('canvasView')">
      <span :class="classes.divider" aria-hidden="true" />
      <ToolbarCanvasView />
    </template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('undoRedo')"><ToolbarUndoRedo /></template>
    <span :class="classes.divider" aria-hidden="true" />
    <template v-if="shows('file')"><ToolbarFile @menu="(key: string) => emit('menu', key)" /></template>
    <template v-if="shows('config')">
      <span :class="classes.divider" aria-hidden="true" />
      <ToolbarConfig @menu="(key: string) => emit('menu', key)" />
    </template>
  </div>
</template>
