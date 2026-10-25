<script setup lang="ts">
import type { CustomType } from "@drawdb/core";
import { computed } from "vue";
import type { PropType } from "vue";
import { NButton } from "naive-ui";
import { useUIStore, type UiTab } from "../../stores/ui.ts";
import TablesTab from "./TablesTab.vue";
import RelationshipsTab from "./RelationshipsTab.vue";
import NotesTab from "./NotesTab.vue";
import AreasTab from "./AreasTab.vue";
import EnumsTab from "./EnumsTab.vue";
import ViewsTab from "./ViewsTab.vue";
import TypesTab from "./TypesTab.vue";
import CustomTypesTab from "./CustomTypesTab.vue";
import SqlHeaderTab from "./SqlHeaderTab.vue";
import IssuesTab from "./IssuesTab.vue";
import { useIssues } from "../../composables/use-issues.ts";

/**
 * The side panel of the editor.
 *
 * It shows one tab per collection of the diagram. The active tab lives in the
 * UI store, so the panel and the canvas always agree on what the user is
 * looking at. Every tab edits the diagram through the diagram store, which
 * records the change in the history and makes it undoable.
 */

/**
 * The tabs of the panel, grouped by what they describe.
 *
 * The groups are what makes the panel readable: the objects of the diagram
 * come first, the database specific parts come second and the report of the
 * diagram comes last. The order inside a group is the order of use.
 */
const TAB_GROUPS: { label: string; tabs: { name: UiTab; label: string }[] }[] = [
  {
    label: "Diagram",
    tabs: [
      { name: "tables", label: "Tables" },
      { name: "relationships", label: "Relations" },
      { name: "notes", label: "Notes" },
      { name: "areas", label: "Areas" },
    ],
  },
  {
    label: "Database",
    tabs: [
      { name: "enums", label: "Enums" },
      { name: "views", label: "Views" },
      { name: "types", label: "Types" },
      { name: "customTypes", label: "Custom Types" },
      { name: "sqlHeader", label: "SQL Header" },
    ],
  },
  {
    label: "Report",
    tabs: [{ name: "issues", label: "Issues" }],
  },
];

/** The label of the tab that is open, shown as the title of the section. */
const activeLabel = computed(
  () =>
    TAB_GROUPS.flatMap((group) => group.tabs).find((tab) => tab.name === ui.activeTab)
      ?.label ?? "",
);

const COMPONENTS = {
  tables: TablesTab,
  relationships: RelationshipsTab,
  notes: NotesTab,
  areas: AreasTab,
  enums: EnumsTab,
  views: ViewsTab,
  types: TypesTab,
  customTypes: CustomTypesTab,
  sqlHeader: SqlHeaderTab,
  issues: IssuesTab,
} as const;

const props = defineProps({
  /** The custom types of the properties of the editor. */
  customTypes: { type: Array as PropType<CustomType[]>, default: () => [] },
});

const ui = useUIStore();
const activeComponent = computed(() => COMPONENTS[ui.activeTab]);
const { issues } = useIssues();

/** Only the tab that edits the custom types of the host application needs them, and the issues tab its list. */
const tabProps = computed(() => {
  if (ui.activeTab === "customTypes") {
    return { customTypes: props.customTypes };
  }
  if (ui.activeTab === "issues") {
    return { issues: issues.value };
  }
  return {};
});
</script>

<template>
  <aside class="side-panel" data-testid="side-panel">
    <nav class="side-panel__tabs" data-testid="side-panel-tabs">
      <div v-for="group in TAB_GROUPS" :key="group.label" class="side-panel__group">
        <span class="side-panel__group-label" aria-hidden="true">{{ group.label }}</span>
        <div class="side-panel__group-tabs">
          <NButton
            v-for="tab in group.tabs"
            :key="tab.name"
            size="small"
            class="side-panel__tab"
            :class="{ 'side-panel__tab--active': ui.activeTab === tab.name }"
            :quaternary="ui.activeTab !== tab.name"
            :type="ui.activeTab === tab.name ? 'primary' : 'default'"
            :data-testid="`${tab.name}-tab`"
            :aria-current="ui.activeTab === tab.name ? 'page' : undefined"
            @click="ui.setActiveTab(tab.name)"
          >
            {{ tab.label }}
          </NButton>
        </div>
      </div>
    </nav>

    <div class="side-panel__section-head">
      <h2 class="side-panel__section-title" data-testid="side-panel-title">
        {{ activeLabel }}
      </h2>
    </div>

    <section class="side-panel__body" :data-testid="`${ui.activeTab}-panel`">
      <component :is="activeComponent" v-bind="tabProps" />
      <p
        v-if="ui.activeTab === 'issues' && issues.length === 0"
        class="side-panel__empty"
        data-testid="issues-empty"
      >
        No issues found.
      </p>
    </section>
  </aside>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--ddb-surface);
  border-right: 1px solid var(--ddb-border);
  position: relative;
  z-index: var(--ddb-z-panel);
}

/* The tab strip is the navigation of the panel: it sits on a slightly
   stronger surface and is separated from the content by a rule. */
.side-panel__tabs {
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-3);
  padding: var(--ddb-space-3);
  background: var(--ddb-surface-muted);
  border-bottom: 1px solid var(--ddb-border);
  flex: none;
}

/* One group of tabs. The label tells what the buttons below it describe. */
.side-panel__group {
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-1);
}

.side-panel__group-label {
  font-size: var(--ddb-text-micro);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ddb-text-muted);
  padding-left: var(--ddb-space-1);
}

.side-panel__group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ddb-space-1);
}

.side-panel__tab {
  font-size: var(--ddb-text-body);
  font-weight: 500;
  height: var(--ddb-hit-target);
  border-radius: var(--ddb-radius-md);
  transition:
    background-color var(--ddb-duration-fast) var(--ddb-easing),
    color var(--ddb-duration-fast) var(--ddb-easing);
}

/* The open tab is the filled pill of the strip, so the place the reader is in
   is visible without relying on the colour alone. */
.side-panel__tab--active {
  font-weight: 600;
}

/* The title of the section repeats the name of the open tab, so the content
   below says what it is about. */
.side-panel__section-head {
  padding: var(--ddb-space-3) var(--ddb-space-3) 0;
  flex: none;
}

.side-panel__section-title {
  margin: 0;
  font-size: var(--ddb-text-title);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.side-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--ddb-space-3);
}

.side-panel__empty {
  margin: var(--ddb-space-3) 0 0;
  color: var(--ddb-text-muted);
  font-size: var(--ddb-text-meta);
}
</style>
