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

const id = computed(() => String(route.params.id ?? ""));

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
    <DrawDBEditor
      v-if="ready && diagram"
      :initial-value="diagram"
      :storage="storage"
      :auto-save="true"
      :auto-save-interval="3000"
    />
  </section>
</template>
