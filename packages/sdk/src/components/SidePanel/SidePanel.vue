<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { useUIStore, type UiTab } from "../../stores/ui.ts";
import TablesTab from "./TablesTab.vue";
import RelationshipsTab from "./RelationshipsTab.vue";
import NotesTab from "./NotesTab.vue";
import AreasTab from "./AreasTab.vue";
import EnumsTab from "./EnumsTab.vue";
import ViewsTab from "./ViewsTab.vue";
import TypesTab from "./TypesTab.vue";

/**
 * The side panel of the editor.
 *
 * It shows one tab per collection of the diagram. The active tab lives in the
 * UI store, so the panel and the canvas always agree on what the user is
 * looking at. Every tab edits the diagram through the diagram store, which
 * records the change in the history and makes it undoable.
 */

const TABS: { name: UiTab; label: string }[] = [
  { name: "tables", label: "Tables" },
  { name: "relationships", label: "Relations" },
  { name: "notes", label: "Notes" },
  { name: "areas", label: "Areas" },
  { name: "enums", label: "Enums" },
  { name: "views", label: "Views" },
  { name: "types", label: "Types" },
];

const COMPONENTS = {
  tables: TablesTab,
  relationships: RelationshipsTab,
  notes: NotesTab,
  areas: AreasTab,
  enums: EnumsTab,
  views: ViewsTab,
  types: TypesTab,
} as const;

const ui = useUIStore();
const activeComponent = computed(() => COMPONENTS[ui.activeTab]);
</script>

<template>
  <aside class="side-panel" data-testid="side-panel">
    <nav class="side-panel__tabs" data-testid="side-panel-tabs">
      <NButton
        v-for="tab in TABS"
        :key="tab.name"
        size="small"
        :quaternary="ui.activeTab !== tab.name"
        :type="ui.activeTab === tab.name ? 'primary' : 'default'"
        :data-testid="`${tab.name}-tab`"
        @click="ui.setActiveTab(tab.name)"
      >
        {{ tab.label }}
      </NButton>
    </nav>

    <section class="side-panel__body" :data-testid="`${ui.activeTab}-panel`">
      <component :is="activeComponent" />
    </section>
  </aside>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--n-color, #fff);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.side-panel__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.side-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
</style>
