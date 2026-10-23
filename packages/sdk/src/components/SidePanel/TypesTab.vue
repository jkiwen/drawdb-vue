<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty, NTag } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";

/** The custom types tab of the side panel. */

const diagram = useDiagramStore();

const types = computed(() => diagram.types);
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="types-list">
      <li v-for="type in types" :key="type.id">
        <NButton
          text
          block
          :data-testid="`type-item-${type.id}`"
        >
          {{ type.name }}
        </NButton>
        <NTag size="small" :bordered="false">
          {{ type.fields.length }}
        </NTag>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-type-${type.id}`"
          @click="diagram.removeEntity('types', type.id)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="types.length === 0" description="No custom types" />
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
