<script setup lang="ts">
/**
 * The per-table view toggles (design 6.2). A click flips the effective state
 * of the scope: the per-table override when a selection exists, the canvas
 * default otherwise. The indexes toggle ships disabled — the index entries
 * of the table are a P2' feature.
 */
import { computed } from "vue";
import type { ViewStateToggles } from "@drawdb/core";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();
const scope = useToolbarScopeStore();

// TODO(i18n Task 7): the titles move into the locale files.
const TOGGLES: {
  key: keyof ViewStateToggles;
  icon: string;
  title: string;
  testid: string;
}[] = [
  { key: "description", icon: "toggle-description", title: "Descriptions", testid: "toolbar-toggle-description" },
  { key: "fields", icon: "toggle-fields", title: "Fields", testid: "toolbar-toggle-fields" },
  { key: "pkUkFk", icon: "toggle-keys", title: "Key markers (PK/UK/FK)", testid: "toolbar-toggle-pkUkFk" },
  {
    key: "indexes",
    icon: "toggle-indexes",
    title: "Indexes — available with the index entries of P2'",
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
  <div :class="classes.group" role="group" aria-label="Table view toggles" data-testid="toolbar-view-toggles">
    <ToolbarButton
      v-for="entry of TOGGLES"
      :key="entry.key"
      :icon="entry.icon"
      :title="entry.title"
      :testid="entry.testid"
      :active="effective[entry.key]"
      :disabled="entry.key === 'indexes'"
      @click="flip(entry.key)"
    />
  </div>
</template>
