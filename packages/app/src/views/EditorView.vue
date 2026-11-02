<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createEmptyDiagram, type Diagram } from "@drawdb/core";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import { getStorage } from "../services/storage.ts";
import { downloadJsonText } from "../services/diagram-io.ts";
import {
  createEditorBridge,
  installEditorBridge,
  removeEditorBridge,
} from "../services/editor-bridge.ts";
import { demoPlugins } from "../services/demo-plugin.ts";

const route = useRoute();
const router = useRouter();
const storage = getStorage();

const diagram = ref<Diagram | undefined>(undefined);
const ready = ref(false);

/** The instance of the editor of the SDK. */
interface EditorInstance {
  autoArrange(): void;
  validate(): { code: string; severity: string; message: string }[];
  openIssuesTab(): void;
  exportSql(): string;
  exportDbml(): string;
  importSql(sql: string, database?: string): unknown;
  jumpHistory(depth: number): boolean;
  runCommand(key: string): boolean;
  getDiagram(): unknown;
}

const editor = ref<EditorInstance | undefined>(undefined);

const id = computed(() => String(route.params.id ?? ""));

/**
 * The bridge the end to end tests drive the editor with.
 *
 * The tests run in the browser, so they need a way into the editor that does
 * not depend on the structure of the components of the application.
 */
const bridge = createEditorBridge(() => editor.value);

/** Publishes the bridge, as soon as the editor of the SDK is mounted. */
watch(
  editor,
  (instance) => {
    if (instance) installEditorBridge(bridge);
  },
  { immediate: true },
);

/** Removes the bridge, so that no test drives an editor that is gone. */
onBeforeUnmount(removeEditorBridge);

/** Arranges the tables of the diagram with the layout of the SDK. */
function autoLayout() {
  editor.value?.autoArrange();
}

/** Validates the diagram and opens the tab that lists its issues. */
function validate() {
  editor.value?.openIssuesTab();
}

/**
 * Handles the entries of the menu of the SDK that it does not handle itself.
 *
 * The SDK reports the keys of the menu, so that the host application can act
 * on the entries that belong to the application rather than to the editor.
 */
function onMenu(event: string | { key?: string }) {
  const key = typeof event === "string" ? event : (event.key ?? "");
  switch (key) {
    case "file:new":
      router.push("/editor");
      break;
    case "file:open":
      router.push("/");
      break;
    case "help:documentation":
    case "help:about":
      window.open("https://drawdb.app", "_blank");
      break;
    default:
      break;
  }
}

/** Downloads the diagram of the editor as a JSON file. */
function onExportJson(payload: string | { json?: string; diagram?: string }) {
  const json =
    typeof payload === "string"
      ? payload
      : (payload.json ?? payload.diagram ?? "");
  if (json) downloadJsonText(json);
}

async function load() {
  ready.value = false;
  const existing = id.value ? await storage.load(id.value) : undefined;
  diagram.value =
    existing ??
    createEmptyDiagram({
      id: id.value || undefined,
      database: "generic",
      title: "",
    });
  ready.value = true;
}

onMounted(load);
watch(id, load);
</script>

<template>
  <section class="view editor" data-testid="editor-view">
    <div class="editor-toolbar" data-testid="editor-toolbar">
      <span class="editor-toolbar__label">Diagram</span>
      <button class="button ghost" type="button" data-testid="auto-layout" @click="autoLayout">
        Auto layout
      </button>
      <button class="button ghost" type="button" data-testid="validate-diagram" @click="validate">
        Validate
      </button>
    </div>
    <DrawDBEditor
      v-if="ready && diagram"
      ref="editor"
      :initial-value="diagram"
      :storage="storage"
      :plugins="demoPlugins"
      :auto-save="true"
      :auto-save-interval="3000"
      @menu="onMenu"
      @export-json="onExportJson"
    />
  </section>
</template>
