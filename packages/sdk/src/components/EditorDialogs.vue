<script setup lang="ts">
import AutoRelationshipsDialog from "./Dialogs/AutoRelationshipsDialog.vue";
import ImageExportDialog from "./Dialogs/ImageExportDialog.vue";
import ImportDialog from "./Dialogs/ImportDialog.vue";
import SqlPreviewDialog from "./Dialogs/SqlPreviewDialog.vue";

/**
 * The dialogs of the editor.
 *
 * The component is the place where the dialogs of the editor live: the
 * preview of the SQL, the import of a diagram, the export of an image and the
 * relationships the editor infers. The host application owns the open state
 * of each one, because it is the one that reacts to the menu of the header.
 */
defineOptions({ name: "DrawDBEditorDialogs" });

withDefaults(
  defineProps<{
    sqlPreviewOpen?: boolean;
    importOpen?: boolean;
    autoRelationshipsOpen?: boolean;
    imageExportOpen?: boolean;
    /** The SVG markup of the canvas, handed to the image export. */
    svg?: string;
  }>(),
  {
    sqlPreviewOpen: false,
    importOpen: false,
    autoRelationshipsOpen: false,
    imageExportOpen: false,
    svg: "",
  },
);

const emit = defineEmits<{
  "update:sqlPreviewOpen": [value: boolean];
  "update:importOpen": [value: boolean];
  "update:autoRelationshipsOpen": [value: boolean];
  "update:imageExportOpen": [value: boolean];
}>();
</script>

<template>
  <div class="ddb-editor__dialogs" data-testid="editor-dialogs">
    <SqlPreviewDialog
      :open="sqlPreviewOpen"
      @update:open="emit('update:sqlPreviewOpen', $event)"
    />
    <ImportDialog
      :open="importOpen"
      @update:open="emit('update:importOpen', $event)"
    />
    <AutoRelationshipsDialog
      :open="autoRelationshipsOpen"
      @update:open="emit('update:autoRelationshipsOpen', $event)"
    />
    <ImageExportDialog
      :open="imageExportOpen"
      :svg="svg"
      @update:open="emit('update:imageExportOpen', $event)"
    />
  </div>
</template>

<style scoped>
.ddb-editor__dialogs {
  display: contents;
}
</style>
