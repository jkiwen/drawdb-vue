<script setup lang="ts">
import { computed } from "vue";
import { NButton, NEmpty } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { t } from "../../i18n/index.ts";

/** The notes tab of the side panel. */

const diagram = useDiagramStore();
const ui = useUIStore();

const notes = computed(() => diagram.notes);
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="notes-list">
      <li v-for="note in notes" :key="note.id">
        <NButton
          text
          block
          :type="ui.selectedNoteIds.includes(String(note.id)) ? 'primary' : 'default'"
          :data-testid="`note-item-${note.id}`"
          @click="ui.selectNote(String(note.id))"
        >
          {{ note.title || t('untitled_note') }}
        </NButton>
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-note-${note.id}`"
          @click="diagram.removeEntity('notes', note.id)"
        >
          ✕
        </NButton>
      </li>
    </ul>

    <NEmpty v-if="notes.length === 0" :description="t('no_notes')" />
  </div>
</template>

<style scoped>
.entity-tab__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-1);
}

.entity-tab__list li {
  display: flex;
  align-items: center;
  gap: var(--ddb-space-2);
  padding: var(--ddb-space-1) var(--ddb-space-2);
  border-radius: var(--ddb-radius-md);
  transition: background-color var(--ddb-duration-fast) var(--ddb-easing);
}

.entity-tab__list li:hover {
  background: var(--ddb-surface-hover);
}
</style>
