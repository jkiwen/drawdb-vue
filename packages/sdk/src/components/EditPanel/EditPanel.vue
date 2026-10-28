<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import styles from "./edit-panel.module.css";
import { resolvePanelTarget } from "./edit-panel-model.ts";
import type { PanelTarget, SelectionSnapshot } from "./edit-panel-model.ts";
import AreaEditor from "./AreaEditor.vue";
import MultiTableEditor from "./MultiTableEditor.vue";
import PanelGroup from "./PanelGroup.vue";
import RelationshipEditor from "./RelationshipEditor.vue";
import TableBasics from "./TableBasics.vue";
import TableEditor from "./TableEditor.vue";
import { commitTableBasics } from "./edit-actions.ts";

/**
 * The unified edit panel of the designer (design section 4): it follows
 * the canvas selection and always shows the logical and the physical
 * side of the selected object next to each other — it never switches
 * between separate logical/physical faces (Q20). Only the field grid
 * condenses the physical columns to read-only text while the logical
 * view layer is active.
 */

const STORAGE_KEY = "ddb.edit-panel.collapsed-groups";

const diagramStore = useDiagramStore();
const ui = useUIStore();
const viewState = useViewStateStore();

const selection = computed<SelectionSnapshot>(() => ({
  tableIds: [...ui.selectedTableIds],
  relationshipIds: [...ui.selectedRelationshipIds],
  areaIds: [...ui.selectedAreaIds],
  noteIds: [...ui.selectedNoteIds],
  fields: ui.selectedFields.map((field) => ({
    tableId: field.tableId,
    fieldId: field.fieldId,
  })),
}));

const target = computed<PanelTarget>(() =>
  resolvePanelTarget(selection.value, diagramStore.diagram),
);

const database = computed(() => diagramStore.diagram.database ?? "generic");
const logicalView = computed(() => viewState.viewLayer === "logical");

/** Collapse memory, per object type (plan section 4.4). */
function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const collapsed = reactive<Record<string, boolean>>(loadCollapsed());
watch(
  () => ({ ...collapsed }),
  (value) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage may be unavailable (private mode); memory still works.
    }
  },
);

function groupKey(group: string): string {
  return `${target.value.kind}:${group}`;
}

function isCollapsed(group: string): boolean {
  return collapsed[groupKey(group)] === true;
}

function toggleGroup(group: string): void {
  const key = groupKey(group);
  collapsed[key] = !collapsed[key];
}

function onBasicsCommit(
  panelTarget: PanelTarget,
  patch: import("./edit-actions.ts").TableBasicsPatch,
): void {
  if (panelTarget.kind !== "table") return;
  commitTableBasics(diagramStore, panelTarget.table, patch);
}

// TODO(i18n): Task 7 moves the panel copy into the locale files.
const EMPTY_COPY: Record<string, string> = {
  none: "Select a table, relationship or area to edit it.",
  mixed: "The selection mixes object types; select objects of one type.",
  note: "Notes are edited on the canvas.",
};
</script>

<template>
  <div :class="styles.panel" data-testid="edit-panel-root">
    <div v-if="target.kind === 'empty'" :class="styles.empty" data-testid="edit-panel-empty">
      {{ EMPTY_COPY[target.reason] ?? EMPTY_COPY.none }}
    </div>

    <template v-else-if="target.kind === 'table'">
      <PanelGroup
        title="Table"
        :collapsed="isCollapsed('basics')"
        testid="group-basics"
        @toggle="toggleGroup('basics')"
      >
        <TableBasics
          :key="`basics:${String(target.table.id)}`"
          :table="target.table"
          @commit="(patch) => onBasicsCommit(target, patch)"
        />
      </PanelGroup>
      <PanelGroup
        title="Fields"
        :collapsed="isCollapsed('fields')"
        testid="group-fields"
        @toggle="toggleGroup('fields')"
      >
        <TableEditor
          :key="String(target.table.id)"
          :table="target.table"
          :database="database"
          :logical-view="logicalView"
          :focus-field-id="target.focusFieldId"
        />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'tables'">
      <PanelGroup
        title="Tables"
        :collapsed="isCollapsed('batch')"
        testid="group-batch"
        @toggle="toggleGroup('batch')"
      >
        <MultiTableEditor :key="target.tables.map((t) => String(t.id)).join(',')" :tables="target.tables" />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'relationship'">
      <PanelGroup
        title="Relationship"
        :collapsed="isCollapsed('relationship')"
        testid="group-relationship"
        @toggle="toggleGroup('relationship')"
      >
        <RelationshipEditor
          :key="String(target.relationship.id)"
          :relationship="target.relationship"
          :logical="target.logical"
        />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'area'">
      <PanelGroup
        title="Subject area"
        :collapsed="isCollapsed('area')"
        testid="group-area"
        @toggle="toggleGroup('area')"
      >
        <AreaEditor :key="String(target.area.id)" :area="target.area" />
      </PanelGroup>
    </template>
  </div>
</template>
