<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import styles from "./edit-panel.module.css";
import { mixedEntries } from "./edit-panel-groups.ts";
import { resolvePanelTarget } from "./edit-panel-model.ts";
import type { PanelTarget, SelectionSnapshot } from "./edit-panel-model.ts";
import AreaEditor from "./AreaEditor.vue";
import DiagramEditor from "./DiagramEditor.vue";
import MultiTableEditor from "./MultiTableEditor.vue";
import NoteEditor from "./NoteEditor.vue";
import PanelGroup from "./PanelGroup.vue";
import RelationshipEditor from "./RelationshipEditor.vue";
import TableAppearance from "./TableAppearance.vue";
import TableBasics from "./TableBasics.vue";
import TableConstraints from "./TableConstraints.vue";
import TableEditor from "./TableEditor.vue";
import TableIndexes from "./TableIndexes.vue";
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
const relationships = computed(() => diagramStore.diagram.relationships);

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

const EMPTY_KEYS: Record<string, string> = {
  none: "edit_panel_empty_none",
  mixed: "edit_panel_empty_mixed",
  note: "edit_panel_empty_note",
};
</script>

<template>
  <div :class="styles.panel" data-testid="edit-panel-root">
    <div v-if="target.kind === 'empty'" :class="styles.empty" data-testid="edit-panel-empty">
      {{ t(EMPTY_KEYS[target.reason] ?? EMPTY_KEYS.none) }}
    </div>

    <div v-else-if="target.kind === 'mixed'" :class="styles.empty" data-testid="edit-panel-mixed">
      <p>{{ t('edit_panel_empty_mixed') }}</p>
      <p :class="styles['mixed-chips']">
        <span
          v-for="entry in mixedEntries(target.counts)"
          :key="entry.key"
          :class="[styles.badge, styles['badge-info']]"
          data-testid="mixed-chip"
        >
          {{ entry.count }} {{ t(entry.key) }}
        </span>
      </p>
    </div>

    <template v-else-if="target.kind === 'table'">
      <PanelGroup
        :title="t('table')"
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
        :title="t('fields')"
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
      <PanelGroup
        :title="t('edit_panel_group_constraints')"
        :collapsed="isCollapsed('constraints')"
        testid="group-constraints"
        @toggle="toggleGroup('constraints')"
      >
        <TableConstraints :table="target.table" :relationships="relationships" />
      </PanelGroup>
      <PanelGroup
        :title="t('edit_panel_group_indexes')"
        :collapsed="isCollapsed('indexes')"
        testid="group-indexes"
        @toggle="toggleGroup('indexes')"
      >
        <TableIndexes :table="target.table" />
      </PanelGroup>
      <PanelGroup
        :title="t('edit_panel_group_appearance')"
        :collapsed="isCollapsed('appearance')"
        testid="group-appearance"
        @toggle="toggleGroup('appearance')"
      >
        <TableAppearance :key="String(target.table.id)" :tables="[target.table]" />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'note'">
      <PanelGroup
        :title="t('edit_panel_group_appearance')"
        :collapsed="isCollapsed('note-appearance')"
        testid="group-note"
        @toggle="toggleGroup('note-appearance')"
      >
        <NoteEditor :key="String(target.note.id)" :note="target.note" />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'diagram'">
      <PanelGroup
        :title="t('edit_panel_group_diagram')"
        :collapsed="isCollapsed('diagram')"
        testid="group-diagram"
        @toggle="toggleGroup('diagram')"
      >
        <DiagramEditor :diagram="target.diagram" />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'tables'">
      <PanelGroup
        :title="t('tables')"
        :collapsed="isCollapsed('batch')"
        testid="group-batch"
        @toggle="toggleGroup('batch')"
      >
        <MultiTableEditor :key="target.tables.map((t) => String(t.id)).join(',')" :tables="target.tables" />
      </PanelGroup>
      <PanelGroup
        :title="t('edit_panel_group_appearance')"
        :collapsed="isCollapsed('batch-appearance')"
        testid="group-batch-appearance"
        @toggle="toggleGroup('batch-appearance')"
      >
        <TableAppearance
          :key="target.tables.map((t) => String(t.id)).join(',')"
          :tables="target.tables"
        />
      </PanelGroup>
    </template>

    <template v-else-if="target.kind === 'relationship'">
      <PanelGroup
        :title="t('relationship')"
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
        :title="t('edit_panel_subject_area')"
        :collapsed="isCollapsed('area')"
        testid="group-area"
        @toggle="toggleGroup('area')"
      >
        <AreaEditor :key="String(target.area.id)" :area="target.area" />
      </PanelGroup>
    </template>
  </div>
</template>
