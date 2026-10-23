<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { createId, deepClone } from "@drawdb/core";
import { appTemplates, findTemplate } from "../services/templates.ts";
import { getStorage } from "../services/storage.ts";

const route = useRoute();
const router = useRouter();

const id = computed(() => String(route.params.id ?? ""));
const current = computed(() => (id.value ? findTemplate(id.value) : undefined));

async function useTemplate() {
  const template = current.value;
  if (!template) {
    return;
  }
  const diagram = deepClone(template.diagram);
  diagram.id = createId();
  diagram.title = template.name;
  await getStorage().save(diagram);
  await router.push(`/editor/${String(diagram.id)}`);
}
</script>

<template>
  <section class="view" data-testid="template-view">
    <div class="view-header">
      <h1>Templates</h1>
      <RouterLink class="button" to="/" data-testid="link-home">Back</RouterLink>
    </div>

    <template v-if="current">
      <h2 data-testid="template-name">{{ current.name }}</h2>
      <p class="muted" data-testid="template-description">{{ current.description }}</p>
      <ul class="list" data-testid="template-tables">
        <li v-for="table in current.diagram.tables" :key="String(table.id)" class="list-item">
          {{ table.name }}
          <span class="muted">{{ table.fields.length }} fields</span>
        </li>
      </ul>
      <button class="button" type="button" data-testid="use-template" @click="useTemplate">
        Open in the editor
      </button>
    </template>

    <ul v-else class="list" data-testid="template-list">
      <li v-for="template in appTemplates" :key="template.id" class="list-item">
        <RouterLink :to="`/templates/${template.id}`" data-testid="template-link">
          {{ template.name }}
        </RouterLink>
        <span class="muted">{{ template.description }}</span>
      </li>
    </ul>
  </section>
</template>
