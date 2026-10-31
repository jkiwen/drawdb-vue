<script setup lang="ts">
import AutoRelationshipsDialog from "./Dialogs/AutoRelationshipsDialog.vue";
import ImageExportDialog from "./Dialogs/ImageExportDialog.vue";
import RelationshipDialog from "./Dialogs/RelationshipDialog.vue";
import SqlPreviewDialog from "./Dialogs/SqlPreviewDialog.vue";

/**
 * The dialogs of the editor.
 *
 * The component is the place where the dialogs of the editor live: the
 * preview of the SQL, the export of an image and the relationships the editor
 * infers. The host application owns the open state of each one, because it is
 * the one that reacts to the menu of the header. The import is a wizard of its
 * own (P8), not one of these dialogs.
 */
defineOptions({ name: "DrawDBEditorDialogs" });

withDefaults(
  defineProps<{
    sqlPreviewOpen?: boolean;
    autoRelationshipsOpen?: boolean;
    imageExportOpen?: boolean;
    relationshipOpen?: boolean;
    /** The SVG markup of the canvas, handed to the image export. */
    svg?: string;
    /** The format the preview of the SQL opens in, when the host picks one. */
    sqlPreviewFormat?: "sql" | "dbml";
  }>(),
  {
    sqlPreviewOpen: false,
    autoRelationshipsOpen: false,
    imageExportOpen: false,
    relationshipOpen: false,
    svg: "",
  },
);

const emit = defineEmits<{
  "update:sqlPreviewOpen": [value: boolean];
  "update:autoRelationshipsOpen": [value: boolean];
  "update:imageExportOpen": [value: boolean];
  "update:relationshipOpen": [value: boolean];
  "update:sqlPreviewFormat": [value: "sql" | "dbml"];
}>();
</script>

<template>
  <div class="ddb-editor__dialogs" data-testid="editor-dialogs">
    <SqlPreviewDialog
      :open="sqlPreviewOpen"
      :format="sqlPreviewFormat"
      @update:open="emit('update:sqlPreviewOpen', $event)"
      @update:format="emit('update:sqlPreviewFormat', $event)"
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
    <RelationshipDialog
      :open="relationshipOpen"
      @update:open="emit('update:relationshipOpen', $event)"
    />
  </div>
</template>

<style scoped>
.ddb-editor__dialogs {
  display: contents;
}
</style>
