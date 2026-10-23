<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty, NTag } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

/** The enums tab of the side panel. */

const diagram = useDiagramStore();

const enums = computed(() => diagram.enums);
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="enums-list">
      <li v-for="item in enums" :key="item.name">
        <NButton
          text
          block
          :data-testid="`enum-item-${item.name}`"
        >
          {{ item.name }}
        </NButton>
        <NTag size="small" :bordered="false">
          {{ item.values.length }}
        </NTag>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-enum-${item.name}`"
          @click="diagram.removeEntity('enums', item.name)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="enums.length === 0" description="No enums" />
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
