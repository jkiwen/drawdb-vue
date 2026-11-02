<script setup lang="ts">
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import ViewEditor from "./ViewEditor.vue";
import { t } from "../../i18n/index.ts";

/** The views tab of the side panel. */

const diagram = useDiagramStore();

const views = computed(() => diagram.views);

function rename(id: string | number, name: string): void {
  diagram.updateView(id, { name });
}

function update(id: string | number, updates: Record<string, unknown>): void {
  diagram.updateView(id, updates);
}
</script>

<template>
  <div class="entity-tab" data-testid="views-tab">
    <ViewEditor
      v-for="view in views"
      :key="view.id"
      :view="view"
      @rename="rename(view.id, $event)"
      @update="update(view.id, $event)"
      @remove="diagram.removeView(view.id)"
    />

    <p v-if="views.length === 0" class="entity-tab__empty">{{ t('no_views') }}</p>
  </div>
</template>

<style scoped>
.entity-tab__empty {
  margin: 0;
  color: var(--ddb-text-muted);
  font-size: var(--ddb-text-meta);
}
</style>
