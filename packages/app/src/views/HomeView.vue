<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { createId, type Diagram } from "@drawdb/core";
import { getStorage } from "../services/storage.ts";

const diagrams = ref<Diagram[]>([]);
const loading = ref(true);
const error = ref("");

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
        <RouterLink class="button" to="/templates" data-testid="link-templates">
          Templates
        </RouterLink>
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
          data-testid="remove-diagram"
          @click="remove(String(diagram.id))"
        >
          Delete
        </button>
      </li>
    </ul>
  </section>
</template>
