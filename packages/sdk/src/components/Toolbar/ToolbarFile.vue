<script setup lang="ts">
/**
 * The file group (design 6.8): New, Open and Save. The actions belong to the
 * host (a new diagram confirms unsaved changes, opening reads a file of the
 * file system), so the buttons only emit the menu key — the editor routes it
 * through the same path as the menu bar (`runEditorMenu` of the
 * editor-menu composable).
 */
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const emit = defineEmits<{ menu: [key: string] }>();

// TODO(i18n Task 7): the titles move into the locale files.
const ACTIONS = [
  { key: "file:new", icon: "file-new", title: "New diagram", testid: "toolbar-file-new" },
  { key: "file:open", icon: "file-open", title: "Open diagram (Ctrl+O)", testid: "toolbar-file-open" },
  { key: "file:save", icon: "file-save", title: "Save (Ctrl+S)", testid: "toolbar-file-save" },
];
</script>

<template>
  <div :class="classes.group" role="group" aria-label="File">
    <ToolbarButton
      v-for="action of ACTIONS"
      :key="action.key"
      :icon="action.icon"
      :title="action.title"
      :testid="action.testid"
      @click="emit('menu', action.key)"
    />
  </div>
</template>
