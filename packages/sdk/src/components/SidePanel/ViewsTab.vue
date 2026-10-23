<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

/** The views tab of the side panel. */

const diagram = useDiagramStore();

const views = computed(() => diagram.views);
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="views-list">
      <li v-for="view in views" :key="view.id">
        <NButton
          text
          block
          :data-testid="`view-item-${view.id}`"
        >
          {{ view.name || "Untitled view" }}
        </NButton>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-view-${view.id}`"
          @click="diagram.removeEntity('views', view.id)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="views.length === 0" description="No views" />
  </div>
</template>

<style scoped>
.entity-tab__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entity-tab__list li {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
