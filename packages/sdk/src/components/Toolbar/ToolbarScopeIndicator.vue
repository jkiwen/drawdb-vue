<script setup lang="ts">
/**
 * The permanent scope indicator of ruling Q1: the display tools apply to the
 * selection when one exists and to the whole canvas otherwise, and the user
 * sees which one at all times.
 */
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { TOOLBAR_ICONS } from "./toolbar-icons.ts";
import classes from "./toolbar.module.css";

const scope = useToolbarScopeStore();

const label = computed(() =>
  scope.scopeKind === "canvas"
    ? t("scope_canvas")
    : t("scope_tables", { count: scope.scopeCount }),
);
</script>

<template>
  <span
    :class="classes.scope"
    data-testid="toolbar-scope"
    :title="t('scope_label')"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="TOOLBAR_ICONS.scope"
    />
    {{ label }}
  </span>
</template>
