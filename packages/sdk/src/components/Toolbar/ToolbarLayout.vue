<script setup lang="ts">
/**
 * The layout group (design 6.3): Grid, Flow and Auto (Flow) applied to the
 * tables of the scope. The selection wins over the whole canvas (ruling Q1)
 * and locked tables never move (ruling Q6), so the group greys when the
 * scope has no movable table left.
 *
 * Grid and Flow are the pure layouts of the core; Auto is the dagre pass the
 * header button has always used, which keeps the relationships straight.
 */
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const diagram = useDiagramStore();
const ui = useUIStore();

/** The tables the layout would move: the selection, or every unlocked one. */
const targets = computed(() => diagram.targetTables(ui.selectedTableIds));

const LAYOUTS = [
  { kind: "grid", icon: "layout-grid", titleKey: "layout_grid", testid: "toolbar-layout-grid" },
  { kind: "flow", icon: "layout-flow", titleKey: "layout_flow", testid: "toolbar-layout-flow" },
] as const;

const movable = computed(() => targets.value.length > 0);
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('layout_group')" data-testid="toolbar-layout">
    <ToolbarButton
      v-for="layout of LAYOUTS"
      :key="layout.kind"
      :icon="layout.icon"
      :title="t(layout.titleKey)"
      :testid="layout.testid"
      :disabled="!movable"
      @click="diagram.layoutTables(layout.kind, ui.selectedTableIds)"
    />
    <ToolbarButton
      icon="layout-auto"
      :title="t('layout_auto')"
      testid="toolbar-layout-auto"
      :disabled="!movable"
      @click="diagram.autoArrange()"
    />
  </div>
</template>
