<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty, NTag } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

/**
 * The relationships tab of the side panel.
 *
 * It lists the relationships of the diagram with the tables they connect and
 * lets the user remove them. The removal goes through the diagram store, so it
 * can be undone.
 */

const diagram = useDiagramStore();
const ui = useUIStore();

const relationships = computed(() => diagram.relationships);

function tableName(id: string | number): string {
  return diagram.tableById(id)?.name ?? String(id);
}

function label(relationship: (typeof relationships.value)[number]): string {
  if (relationship.name) return relationship.name;
  return `${tableName(relationship.startTableId)} → ${tableName(
    relationship.endTableId,
  )}`;
}
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="relationships-list">
      <li v-for="relationship in relationships" :key="relationship.id">
        <NButton
          text
          block
          :type="ui.selectedRelationshipIds.includes(String(relationship.id)) ? 'primary' : 'default'"
          :data-testid="`relationship-item-${relationship.id}`"
          @click="ui.selectRelationship(String(relationship.id))"
        >
          {{ label(relationship) }}
        </NButton>
        <NTag v-if="relationship.cardinality" size="small" :bordered="false">
          {{ relationship.cardinality }}
        </NTag>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-relationship-${relationship.id}`"
          @click="diagram.removeRelationship(relationship.id)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="relationships.length === 0" description="No relationships" />
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
