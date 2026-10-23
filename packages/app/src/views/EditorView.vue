<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { createEmptyDiagram, type Diagram } from "@drawdb/core";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import { getStorage } from "../services/storage.ts";

const route = useRoute();
const storage = getStorage();

const diagram = ref<Diagram | undefined>(undefined);
const ready = ref(false);

/** The instance of the editor of the SDK. */
interface EditorInstance {
  autoArrange(): void;
  validate(): { code: string; severity: string; message: string }[];
  openIssuesTab(): void;
}

const editor = ref<EditorInstance | undefined>(undefined);

const id = computed(() => String(route.params.id ?? ""));

/** Arranges the tables of the diagram with the layout of the SDK. */
function autoLayout() {
  editor.value?.autoArrange();
}

/** Validates the diagram and opens the tab that lists its issues. */
function validate() {
  editor.value?.openIssuesTab();
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
    <div class="editor-toolbar">
      <button class="button" type="button" data-testid="auto-layout" @click="autoLayout">
        Auto layout
      </button>
      <button class="button" type="button" data-testid="validate-diagram" @click="validate">
        Validate
      </button>
    </div>
    <DrawDBEditor
      v-if="ready && diagram"
      ref="editor"
      :initial-value="diagram"
      :storage="storage"
      :auto-save="true"
      :auto-save-interval="3000"
    />
  </section>
</template>
