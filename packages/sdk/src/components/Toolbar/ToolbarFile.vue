<script setup lang="ts">
/**
 * The file group (design 6.8): New, Open, Save, Save as, Import and Export.
 * The actions belong to the host (a new diagram confirms unsaved changes,
 * opening reads a file of the file system), so the buttons only emit the menu
 * key — the editor routes it through the same path as the menu bar
 * (`runEditorMenu` of the editor-menu composable).
 *
 * Printing hands the sheet to the print preview of the editor (ruling Q8);
 * the host may still claim either key through its own menu handler.
 */
import { t } from "../../i18n/index.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const emit = defineEmits<{ menu: [key: string] }>();

const ACTIONS = [
  { key: "file:new", icon: "file-new", titleKey: "file_new", testid: "toolbar-file-new" },
  { key: "file:open", icon: "file-open", titleKey: "file_open", testid: "toolbar-file-open" },
  { key: "file:save", icon: "file-save", titleKey: "file_save", testid: "toolbar-file-save" },
  { key: "file:saveAs", icon: "file-save-as", titleKey: "file_save_as", testid: "toolbar-file-save-as" },
  { key: "file:import", icon: "file-import", titleKey: "file_import", testid: "toolbar-file-import" },
  { key: "file:export", icon: "file-export", titleKey: "file_export", testid: "toolbar-file-export" },
  { key: "file:print-preview", icon: "file-print-preview", titleKey: "file_print_preview", testid: "toolbar-file-print-preview" },
  { key: "file:print", icon: "file-print", titleKey: "file_print", testid: "toolbar-file-print" },
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
