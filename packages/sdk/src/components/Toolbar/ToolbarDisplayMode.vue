<script setup lang="ts">
/**
 * The display mode switch (design 6.1): the four presets of the view
 * toggles. A manual toggle change derives the mode `custom` (Q20), which the
 * switch shows as a highlighted, non-clickable state — the user cannot ask
 * for `custom`, only reach it through the toggles.
 */
import type { DisplayMode } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();
const scope = useToolbarScopeStore();

type PresetMode = Exclude<DisplayMode, "custom">;

const MODES: { mode: PresetMode; icon: string; titleKey: string }[] = [
  { mode: "entity", icon: "mode-entity", titleKey: "display_mode_entity" },
  { mode: "definition", icon: "mode-definition", titleKey: "display_mode_definition" },
  { mode: "attributes", icon: "mode-attributes", titleKey: "display_mode_attributes" },
  { mode: "all", icon: "mode-all", titleKey: "display_mode_full" },
];
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('display_mode_group')" data-testid="toolbar-display-mode">
    <ToolbarButton
      v-for="entry of MODES"
      :key="entry.mode"
      :icon="entry.icon"
      :title="t(entry.titleKey)"
      :testid="`toolbar-mode-${entry.mode}`"
      :active="viewState.displayMode === entry.mode"
      @click="scope.setScopedDisplayMode(entry.mode)"
    />
    <ToolbarButton
      icon="mode-custom"
      :title="t('display_mode_custom')"
      testid="toolbar-mode-custom"
      :active="viewState.displayMode === 'custom'"
      disabled
    />
  </div>
</template>
