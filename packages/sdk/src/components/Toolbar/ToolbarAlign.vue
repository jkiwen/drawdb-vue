<script setup lang="ts">
/**
 * The alignment group (design 6.5): align the selected tables on one edge or
 * centre, and spread them evenly. Alignment needs two targets, distributing
 * needs three; the buttons grey with that reason in the tooltip. The moves
 * land as one command, so a single undo puts every table back (Q12 spirit).
 */
import { computed } from "vue";
import type { AlignMode, DistributeAxis } from "../../composables/align-geometry.ts";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const diagram = useDiagramStore();
const ui = useUIStore();

const ALIGNMENTS: {
  mode: AlignMode;
  icon: string;
  titleKey: string;
  testid: string;
}[] = [
  { mode: "left", icon: "align-left", titleKey: "align_left", testid: "toolbar-align-left" },
  { mode: "center-h", icon: "align-center-h", titleKey: "align_center_h", testid: "toolbar-align-center-h" },
  { mode: "right", icon: "align-right", titleKey: "align_right", testid: "toolbar-align-right" },
  { mode: "top", icon: "align-top", titleKey: "align_top", testid: "toolbar-align-top" },
  { mode: "center-v", icon: "align-center-v", titleKey: "align_center_v", testid: "toolbar-align-center-v" },
  { mode: "bottom", icon: "align-bottom", titleKey: "align_bottom", testid: "toolbar-align-bottom" },
];

const DISTRIBUTIONS: {
  axis: DistributeAxis;
  icon: string;
  titleKey: string;
  testid: string;
}[] = [
  { axis: "horizontal", icon: "distribute-h", titleKey: "distribute_horizontal", testid: "toolbar-distribute-h" },
  { axis: "vertical", icon: "distribute-v", titleKey: "distribute_vertical", testid: "toolbar-distribute-v" },
];

// Alignment is about the selection only: aligning every table of the canvas
// would stack them on one edge, which nobody means. Locked tables are out
// (Q6), so a selection of locked tables greys the group as well.
const targets = computed(() => diagram.selectedTables(ui.selectedTableIds));
const canAlign = computed(() => targets.value.length >= 2);
const canDistribute = computed(() => targets.value.length >= 3);

/** The tooltip carries the reason a button is greyed (state 2 of 6.0). */
function title(key: string, enabled: boolean, reason: string): string {
  return enabled ? t(key) : `${t(key)} — ${reason}`;
}

const alignReason = computed(() =>
  canAlign.value ? "" : t("needs_two_tables"),
);
const distributeReason = computed(() =>
  canDistribute.value ? "" : t("needs_three_tables"),
);
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('align_group')" data-testid="toolbar-align">
    <ToolbarButton
      v-for="entry of ALIGNMENTS"
      :key="entry.mode"
      :icon="entry.icon"
      :title="title(entry.titleKey, canAlign, alignReason)"
      :testid="entry.testid"
      :disabled="!canAlign"
      @click="diagram.alignTables(entry.mode, ui.selectedTableIds)"
    />
    <span :class="classes.divider" aria-hidden="true" />
    <ToolbarButton
      v-for="entry of DISTRIBUTIONS"
      :key="entry.axis"
      :icon="entry.icon"
      :title="title(entry.titleKey, canDistribute, distributeReason)"
      :testid="entry.testid"
      :disabled="!canDistribute"
      @click="diagram.distributeTables(entry.axis, ui.selectedTableIds)"
    />
  </div>
</template>
