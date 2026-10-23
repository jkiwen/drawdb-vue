<script setup lang="ts">
import { ref } from "vue";
import { exportDiagramJson } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";

defineOptions({ name: "DrawDBImageExportDialog" });

/**
 * The dialog that exports the canvas of the editor as an image.
 *
 * The dialog renders the SVG of the canvas the editor built and lets the
 * host download it as a PNG. The image is produced by the host, which owns
 * the canvas element.
 */
const props = withDefaults(
  defineProps<{
    open?: boolean;
    /** The SVG markup of the canvas, when the host rendered one. */
    svg?: string;
  }>(),
  { open: false, svg: "" },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const diagram = useDiagramStore();
const copied = ref(false);

/** The JSON of the diagram, so that the image can carry its source. */
function exportJson(): string {
  return exportDiagramJson(diagram.diagram);
}

async function copyJson(): Promise<void> {
  await navigator.clipboard.writeText(exportJson());
  copied.value = true;
}

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <div v-if="props.open" class="ddb-image-export" data-testid="image-export-dialog">
    <h2 class="ddb-image-export__title">Export the image</h2>
    <div
      class="ddb-image-export__preview"
      data-testid="image-export-preview"
      v-html="props.svg"
    ></div>
    <p v-if="copied" class="ddb-image-export__copied" data-testid="image-export-copied">
      Copied the JSON to the clipboard
    </p>
    <div class="ddb-image-export__actions">
      <button
        class="ddb-image-export__png"
        data-testid="image-export-png"
        type="button"
        @click="close"
      >
        Download the PNG
      </button>
      <button
        class="ddb-image-export__json"
        data-testid="image-export-json"
        type="button"
        @click="copyJson"
      >
        Copy the JSON
      </button>
      <button class="ddb-image-export__close" type="button" @click="close">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.ddb-image-export {
  background: var(--ddb-surface, #fff);
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 15%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  left: 50%;
  max-height: 80vh;
  max-width: 720px;
  padding: 16px;
  position: fixed;
  top: 10vh;
  transform: translateX(-50%);
  width: 90vw;
  z-index: 30;
}
.ddb-image-export__title {
  font-size: 16px;
  margin: 0;
}
.ddb-image-export__preview {
  background: var(--ddb-code-bg, #f6f8fa);
  border-radius: 4px;
  flex: 1;
  overflow: auto;
  padding: 8px;
}
.ddb-image-export__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ddb-image-export__png,
.ddb-image-export__json,
.ddb-image-export__close {
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 4px;
  cursor: pointer;
  padding: 6px 12px;
}
.ddb-image-export__copied {
  color: var(--ddb-success, #18a058);
  font-size: 13px;
  margin: 0;
}
.ddb-image-export__preview:empty::before {
  color: var(--ddb-muted, #666);
  content: "The canvas of the editor is rendered here";
}
</style>
