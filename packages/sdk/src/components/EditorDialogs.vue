<script setup lang="ts">
/**
 * The dialogs of the editor.
 *
 * The component is the place where the dialogs of the editor live: the
 * preview of the SQL, the import of a diagram, the export of an image and the
 * relationships the editor infers. The dialogs that are not built yet do not
 * render anything.
 */
defineOptions({ name: "DrawDBEditorDialogs" });
</script>

<template>
  <div class="ddb-editor__dialogs" data-testid="editor-dialogs" />
</template>

<style scoped>
.ddb-editor__dialogs {
  display: contents;
}
</style>
