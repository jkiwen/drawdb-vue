<script setup lang="ts">
/**
 * The logical/physical layer switch (design 6.4): one button that flips the
 * layer and says where a click leads.
 */
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const viewState = useViewStateStore();

const title = computed(() =>
  t(
    viewState.viewLayer === "logical"
      ? "view_layer_logical"
      : "view_layer_physical",
  ),
);

function flip(): void {
  viewState.setViewLayer(
    viewState.viewLayer === "logical" ? "physical" : "logical",
  );
}
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('view_layer_group')">
    <ToolbarButton
      icon="view-layer"
      :title="title"
      testid="toolbar-view-layer"
      :active="viewState.viewLayer === 'logical'"
      @click="flip"
    />
  </div>
</template>
