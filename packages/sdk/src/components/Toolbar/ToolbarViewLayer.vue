<script setup lang="ts">
/**
 * The logical/physical layer switch (design 6.4): one button that flips the
 * layer and says where a click leads.
 */
import { computed } from "vue";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();

// TODO(i18n Task 7): the titles move into the locale files.
const title = computed(() =>
  viewState.viewLayer === "logical"
    ? "Logical view — switch to physical"
    : "Physical view — switch to logical",
);

function flip(): void {
  viewState.setViewLayer(
    viewState.viewLayer === "logical" ? "physical" : "logical",
  );
}
</script>

<template>
  <div :class="classes.group" role="group" aria-label="View layer">
    <ToolbarButton
      icon="view-layer"
      :title="title"
      testid="toolbar-view-layer"
      :active="viewState.viewLayer === 'logical'"
      @click="flip"
    />
  </div>
</template>
