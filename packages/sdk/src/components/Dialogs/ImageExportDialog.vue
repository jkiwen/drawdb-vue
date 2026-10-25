<script setup lang="ts">
import { ref, watch } from "vue";
import { exportDiagramJson } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { exportPng } from "../../composables/use-image-export.ts";

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
const scale = ref("1");
const background = ref("#ffffff");
const done = ref(false);
const error = ref("");
/** The markup of the canvas, shown as the preview of the image. */
const preview = ref("");

/** The live canvas of the editor, the element the image is made of. */
function canvasElement(): HTMLElement | null {
  return document.querySelector('[data-testid="canvas"]') as HTMLElement | null;
}

/** Reads the canvas of the editor, so that the dialog shows what it holds. */
function readCanvas(): void {
  const element = canvasElement();
  if (!element) {
    preview.value = props.svg;
    return;
  }
  // The copy of the canvas is only a preview: it drops the testid of the
  // canvas, so that the editor keeps a single element that answers to it.
  preview.value = element.outerHTML.replace(
    /\s+data-testid="canvas"/g,
    "",
  );
}

// The dialog shows the canvas of the editor, so it reads it when it opens.
watch(
  () => props.open,
  (open) => {
    if (open) {
      readCanvas();
    }
  },
  { immediate: true },
);

/** The JSON of the diagram, so that the image can carry its source. */
function exportJson(): string {
  return exportDiagramJson(diagram.diagram);
}

async function copyJson(): Promise<void> {
  await navigator.clipboard.writeText(exportJson());
  copied.value = true;
}

/** Renders the canvas of the editor as a PNG. */
async function download(): Promise<void> {
  done.value = false;
  error.value = "";
  const element = canvasElement();
  if (!element) {
    error.value = "The canvas of the editor is not on the page";
    return;
  }
  try {
    await exportPng(element, {
      pixelRatio: Number(scale.value),
      backgroundColor: background.value,
    });
    done.value = true;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  }
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
      v-html="preview"
    ></div>
    <label class="ddb-image-export__option">
      Scale
      <select v-model="scale" class="ddb-image-export__scale" data-testid="image-export-scale">
        <option value="1">1×</option>
        <option value="2">2×</option>
        <option value="3">3×</option>
      </select>
    </label>
    <label class="ddb-image-export__option">
      Background
      <input
        v-model="background"
        class="ddb-image-export__background"
        data-testid="image-export-background"
        type="color"
      />
    </label>
    <p v-if="done" class="ddb-image-export__done" data-testid="image-export-done">
      The image was rendered
    </p>
    <p v-if="error" class="ddb-image-export__error" data-testid="image-export-error">
      {{ error }}
    </p>
    <p v-if="copied" class="ddb-image-export__copied" data-testid="image-export-copied">
      Copied the JSON to the clipboard
    </p>
    <div class="ddb-image-export__actions">
      <button
        class="ddb-image-export__png"
        data-testid="image-export-png"
        type="button"
        @click="download"
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
.ddb-image-export__option {
  align-items: center;
  display: flex;
  font-size: 13px;
  gap: 8px;
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
.ddb-image-export__copied,
.ddb-image-export__done {
  color: var(--ddb-success, #18a058);
  font-size: 13px;
  margin: 0;
}
.ddb-image-export__error {
  color: var(--ddb-danger, #d03050);
  font-size: 13px;
  margin: 0;
}
.ddb-image-export__preview:empty::before {
  color: var(--ddb-muted, #666);
  content: "The canvas of the editor is rendered here";
}
</style>
