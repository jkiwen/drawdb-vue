<script setup lang="ts">
/**
 * The file group (design 6.8): New, Open and Save. The actions belong to the
 * host (a new diagram confirms unsaved changes, opening reads a file of the
 * file system), so the buttons only emit the menu key — the editor routes it
 * through the same path as the menu bar (`runEditorMenu` of the
 * editor-menu composable).
 */
import { t } from "../../i18n/index.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const emit = defineEmits<{ menu: [key: string] }>();

const ACTIONS = [
  { key: "file:new", icon: "file-new", titleKey: "file_new", testid: "toolbar-file-new" },
  { key: "file:open", icon: "file-open", titleKey: "file_open", testid: "toolbar-file-open" },
  { key: "file:save", icon: "file-save", titleKey: "file_save", testid: "toolbar-file-save" },
];
</script>

<template>
  <div :class="classes.group" role="group" :aria-label="t('file')" data-testid="toolbar-file">
    <ToolbarButton
      v-for="action of ACTIONS"
      :key="action.key"
      :icon="action.icon"
      :title="t(action.titleKey)"
      :testid="action.testid"
      @click="emit('menu', action.key)"
    />
  </div>
</template>
