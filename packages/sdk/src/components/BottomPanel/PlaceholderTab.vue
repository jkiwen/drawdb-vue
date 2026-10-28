<script setup lang="ts">
import { t } from "../../i18n/index.ts";
import classes from "./BottomPanel.module.css";

/**
 * The placeholder of a tab of the bottom panel whose channel is not wired
 * yet. The log tab (import/export, save and plugin events) and the trace
 * tab (performance counters, developer mode only — ruling Q14) render
 * their empty state this way; the structure is ready for the real lists.
 */
defineOptions({ name: "DrawDBBottomPanelPlaceholderTab" });

defineProps({
  /** The test id of the tab body, one per tab. */
  testid: { type: String, required: true },
  /** The empty-state message of the tab. */
  message: { type: String, default: () => t("bottom_placeholder_default") },
});
</script>

<template>
  <div :class="classes.tabBody" :data-testid="`${testid}-tab`">
    <p :class="classes.empty" :data-testid="`${testid}-empty`">{{ message }}</p>
  </div>
</template>
