<script setup lang="ts">
/**
 * The canvas view group (issue 11): the grid of points and the panel of the
 * outline, both of which used to sit in the row of the header.
 */
import { t } from "../../i18n/index.ts";
import { useUIStore } from "../../stores/ui.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const ui = useUIStore();
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('canvas_view_group')" data-testid="toolbar-canvas-view">
    <ToolbarButton
      icon="grid"
      :title="t('show_grid')"
      testid="toggle-grid-btn"
      :active="ui.showGrid"
      @click="ui.toggleGrid()"
    />
    <ToolbarButton
      icon="panel"
      :title="t('sidebar')"
      testid="toggle-sidebar-btn"
      :active="ui.sidebarOpen"
      @click="ui.toggleSidebar()"
    />
  </div>
</template>
