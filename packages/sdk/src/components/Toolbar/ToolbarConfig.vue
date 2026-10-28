<script setup lang="ts">
/**
 * The configuration group (design 6.9). The button is the entry of the
 * preferences of the host: the display tokens, the tool settings and the
 * metadata settings are still to be sorted out (Q7 keeps them in a separate
 * preferences dialog owned by the application, not in the diagram), so the
 * editor only emits the menu key and the host decides what opens.
 */
import { t } from "../../i18n/index.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const emit = defineEmits<{ menu: [key: string] }>();
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('config_group')" data-testid="toolbar-config-group">
    <ToolbarButton
      icon="settings"
      :title="t('config_pending')"
      testid="toolbar-config"
      @click="emit('menu', 'config:open')"
    />
  </div>
</template>
