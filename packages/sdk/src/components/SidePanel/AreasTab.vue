<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

/** The areas tab of the side panel. */

const diagram = useDiagramStore();
const ui = useUIStore();

const areas = computed(() => diagram.areas);
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="areas-list">
      <li v-for="area in areas" :key="area.id">
        <NButton
          text
          block
          :type="ui.selectedAreaIds.includes(String(area.id)) ? 'primary' : 'default'"
          :data-testid="`area-item-${area.id}`"
          @click="ui.selectArea(String(area.id))"
        >
          {{ area.name || "Untitled area" }}
        </NButton>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-area-${area.id}`"
          @click="diagram.removeEntity('areas', area.id)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="areas.length === 0" description="No areas" />
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
