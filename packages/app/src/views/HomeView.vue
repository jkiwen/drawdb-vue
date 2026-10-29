<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { createId, type Diagram } from "@drawdb/core";
import { downloadDiagramJson, readDiagramJsonFile } from "../services/diagram-io.ts";
import { getStorage } from "../services/storage.ts";
import { t } from "@drawdb/vue-sdk";
import PreferencesDialog from "../components/PreferencesDialog.vue";

const router = useRouter();
const diagrams = ref<Diagram[]>([]);
const loading = ref(true);
const error = ref("");

/**
 * Opens the file picker of the browser.
 *
 * The template ref has to be a ref and not a plain variable: a template ref
 * that is not a ref does not work in the production build.
 */
const picker = ref<HTMLInputElement | undefined>();

/** Whether the application-wide preferences are open (ruling Q7). */
const preferencesOpen = ref(false);

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    diagrams.value = await getStorage().list();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

async function remove(id: string) {
  await getStorage().delete(id);
  await refresh();
}

/** Imports a diagram the user picked and opens it in the editor. */
async function importDiagram(file: File) {
  try {
    const diagram = await readDiagramJsonFile(file);
    await getStorage().save(diagram);
    await router.push(`/editor/${String(diagram.id)}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

/** Hands the file input of the browser the click of the button. */
function pickDiagram() {
  picker.value?.click();
}

onMounted(refresh);
</script>

<template>
  <section class="view" data-testid="home-view">
    <div class="view-header">
      <h1>Diagrams</h1>
      <div class="view-actions">
        <RouterLink class="button" :to="`/editor/${createId()}`" data-testid="new-diagram">
          New diagram
        </RouterLink>
        <RouterLink class="button ghost" to="/templates" data-testid="link-templates">
          Templates
        </RouterLink>
        <RouterLink class="button ghost" to="/types" data-testid="link-types">
          {{ t("type_system_title") }}
        </RouterLink>
        <button class="button ghost" type="button" data-testid="open-preferences" @click="preferencesOpen = true">
          {{ t("settings") }}
        </button>
        <button class="button ghost" type="button" data-testid="import-json" @click="pickDiagram">
          Import JSON
        </button>
        <input
          ref="picker"
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          data-testid="import-json-input"
          @change="importDiagram(($event.target as HTMLInputElement).files?.[0] as File)"
        />
      </div>
    </div>

    <p v-if="loading" data-testid="home-loading">Loading…</p>
    <p v-else-if="error" class="error" data-testid="home-error">{{ error }}</p>
    <p v-else-if="diagrams.length === 0" data-testid="home-empty">
      No diagram yet. Create one to get started.
    </p>

    <ul v-else class="list" data-testid="diagram-list">
      <li v-for="diagram in diagrams" :key="String(diagram.id)" class="list-item">
        <RouterLink :to="`/editor/${String(diagram.id)}`" data-testid="diagram-link">
          {{ diagram.title || "Untitled" }}
        </RouterLink>
        <span class="muted">{{ diagram.database }}</span>
        <button
          class="button ghost"
          type="button"
          data-testid="export-json"
          @click="downloadDiagramJson(diagram)"
        >
          Export JSON
        </button>
        <button
          class="button ghost"
          type="button"
          data-testid="remove-diagram"
          @click="remove(String(diagram.id))"
        >
          Delete
        </button>
      </li>
    </ul>
  </section>
  <div v-if="preferencesOpen" class="preferences-backdrop" data-testid="preferences-backdrop" @click.self="preferencesOpen = false">
    <div class="preferences-sheet">
      <PreferencesDialog />
      <button class="button ghost" type="button" data-testid="close-preferences" @click="preferencesOpen = false">
        {{ t("close") }}
      </button>
    </div>
  </div>
</template>
