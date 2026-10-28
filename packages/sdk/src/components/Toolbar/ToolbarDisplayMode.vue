<script setup lang="ts">
/**
 * The display mode switch (design 6.1): the four presets of the view
 * toggles. A manual toggle change derives the mode `custom` (Q20), which the
 * switch shows as a highlighted, non-clickable state — the user cannot ask
 * for `custom`, only reach it through the toggles.
 */
import type { DisplayMode } from "@drawdb/core";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();
const scope = useToolbarScopeStore();

type PresetMode = Exclude<DisplayMode, "custom">;

// TODO(i18n Task 7): the titles move into the locale files.
const MODES: { mode: PresetMode; icon: string; title: string }[] = [
  { mode: "entity", icon: "mode-entity", title: "Entity view: table headers only" },
  { mode: "definition", icon: "mode-definition", title: "Definition view: headers and descriptions" },
  { mode: "attributes", icon: "mode-attributes", title: "Attributes view: headers and fields" },
  { mode: "all", icon: "mode-all", title: "Full view: everything" },
];
</script>

<template>
  <div :class="classes.group" role="group" aria-label="Display mode" data-testid="toolbar-display-mode">
    <ToolbarButton
      v-for="entry of MODES"
      :key="entry.mode"
      :icon="entry.icon"
      :title="entry.title"
      :testid="`toolbar-mode-${entry.mode}`"
      :active="viewState.displayMode === entry.mode"
      @click="scope.setScopedDisplayMode(entry.mode)"
    />
    <ToolbarButton
      icon="mode-custom"
      title="Custom view: a manual combination of the toggles below"
      testid="toolbar-mode-custom"
      :active="viewState.displayMode === 'custom'"
      disabled
    />
  </div>
</template>
