<script setup lang="ts">
/**
 * The per-table view toggles (design 6.2). A click flips the effective state
 * of the scope: the per-table override when a selection exists, the canvas
 * default otherwise. The indexes toggle ships disabled — the index entries
 * of the table are a P2' feature.
 */
import { computed } from "vue";
import type { ViewStateToggles } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();
const scope = useToolbarScopeStore();

const TOGGLES: {
  key: keyof ViewStateToggles;
  icon: string;
  titleKey: string;
  testid: string;
}[] = [
  { key: "description", icon: "toggle-description", titleKey: "toggle_descriptions", testid: "toolbar-toggle-description" },
  { key: "fields", icon: "toggle-fields", titleKey: "fields", testid: "toolbar-toggle-fields" },
  { key: "pkUkFk", icon: "toggle-keys", titleKey: "toggle_key_markers", testid: "toolbar-toggle-pkUkFk" },
  {
    key: "indexes",
    icon: "toggle-indexes",
    titleKey: "toggle_indexes",
    testid: "toolbar-toggle-indexes",
  },
];

/**
 * What the buttons show: with a selection, the effective state of the first
 * scoped table (override ?? canvas default); without one, the canvas default.
 */
const effective = computed<ViewStateToggles>(() => {
  const first = scope.scopeTableIds[0];
  const override = first ? scope.overrideFor(first) : undefined;
  return { ...viewState.toggles, ...override };
});

function flip(key: keyof ViewStateToggles): void {
  scope.setScopedToggle(key, !effective.value[key]);
}
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('toggle_group')" data-testid="toolbar-view-toggles">
    <ToolbarButton
      v-for="entry of TOGGLES"
      :key="entry.key"
      :icon="entry.icon"
      :title="t(entry.titleKey)"
      :testid="entry.testid"
      :active="effective[entry.key]"
      :disabled="entry.key === 'indexes'"
      @click="flip(entry.key)"
    />
  </div>
</template>
