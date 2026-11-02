<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, watchEffect } from "vue";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import OutlineNodeRow from "./OutlineNodeRow.vue";
import OutlineMenu from "./OutlineMenu.vue";
import {
  createOutlineNode,
  creatableCategoryOf,
  deleteOutlineNode,
  renameOutlineNode,
} from "./outline-actions.ts";
import {
  buildOutlineTree,
  flattenOutlineTree,
  outlineBranchIds,
  outlineNodePath,
  windowOutlineRows,
  type OutlineNode,
  type OutlineSortMode,
} from "./outline-model.ts";
import classes from "./outline-tree.module.css";

/**
 * The left outline tree (plan Task 2): category badges, fuzzy filter over
 * both layer names, name / creation-order sort, dependency-free virtual
 * scroll. Selection is two-way (design 3.2): a click selects in the ui
 * store and re-emits `focus`; a ui-store change reveals the node here.
 */

const ROW_HEIGHT = 26;

const emit = defineEmits<{
  focus: [payload: { kind: string; id: string | number; tableId?: string | number }];
  "assign-to-area": [payload: { tableId: string | number; areaId: string | number }];
}>();

const diagramStore = useDiagramStore();
const ui = useUIStore();
const viewState = useViewStateStore();

const filterText = ref("");
const sortMode = ref<OutlineSortMode>("created");
const filterActive = computed(() => filterText.value.trim() !== "");

const tree = computed(() =>
  buildOutlineTree(
    diagramStore.diagram,
    viewState.viewLayer,
    filterText.value,
    sortMode.value,
  ),
);

// The expansion defaults: the categories, the areas and the groups of a table
// start open, the tables start closed; an explicit toggle always wins.
const expanded = ref(new Set<string>());
const decided = new Set<string>();
watchEffect(() => {
  for (const id of outlineBranchIds(
    tree.value,
    (node) => node.kind === "group" || (node.kind !== "table" && node.kind !== "field"),
  )) {
    if (!decided.has(id)) {
      decided.add(id);
      expanded.value.add(id);
    }
  }
});

const effectiveExpanded = computed(() =>
  // An active filter auto-expands every branch so the matches are visible.
  filterActive.value ? outlineBranchIds(tree.value) : expanded.value,
);

const rows = computed(() => flattenOutlineTree(tree.value, effectiveExpanded.value));

const bodyRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(600);
onMounted(() => {
  const height = bodyRef.value?.clientHeight ?? 0;
  if (height > 0) viewportHeight.value = height;
});

function onScroll(event: Event): void {
  scrollTop.value = (event.target as HTMLElement).scrollTop;
}

const windowedRows = computed(() =>
  windowOutlineRows(rows.value, scrollTop.value, viewportHeight.value),
);

const showEmpty = computed(
  () => !filterActive.value && tree.value.every((node) => node.count === 0),
);
const showNoMatches = computed(() => filterActive.value && tree.value.length === 0);

// —— Selection (tree → ui store, ui store → reveal) ——

const currentNodeId = computed(() => {
  const field = ui.selectedFields[ui.selectedFields.length - 1];
  if (field) return `field:${field.tableId}:${field.fieldId}`;
  const last = (ids: (string | number)[]) => ids[ids.length - 1];
  if (ui.selectedTableIds.length) return `table:${last(ui.selectedTableIds)}`;
  if (ui.selectedRelationshipIds.length)
    return `relationship:${last(ui.selectedRelationshipIds)}`;
  if (ui.selectedNoteIds.length) return `note:${last(ui.selectedNoteIds)}`;
  if (ui.selectedAreaIds.length) return `area:${last(ui.selectedAreaIds)}`;
  return undefined;
});

/** Expands the ancestors of a node and scrolls it into view. */
async function reveal(nodeId: string): Promise<void> {
  const path = outlineNodePath(tree.value, nodeId);
  if (!path) return;
  for (const ancestor of path.slice(0, -1)) expanded.value.add(ancestor.id);
  await nextTick();
  const index = rows.value.findIndex((row) => row.node.id === nodeId);
  if (index >= 0 && bodyRef.value) {
    bodyRef.value.scrollTop = Math.max(0, (index - 2) * ROW_HEIGHT);
    scrollTop.value = bodyRef.value.scrollTop;
  }
}
defineExpose({ reveal });

watch(currentNodeId, (id) => {
  if (id !== undefined) void reveal(id);
});

function toggle(id: string): void {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
}

function select(node: OutlineNode): void {
  if (node.kind === "category" || node.kind === "group") {
    toggle(node.id);
    return;
  }
  if (node.kind === "constraint") {
    // A key belongs to its table; a foreign key also selects the relationship (issue 8).
    ui.selectTable(String(node.parentRefId));
    if (node.id.includes(":foreign:")) ui.selectRelationship(String(node.refId));
  } else if (node.kind === "table" || node.kind === "area-table") ui.selectTable(String(node.refId));
  else if (node.kind === "field")
    ui.selectField(String(node.parentRefId), String(node.refId));
  else if (node.kind === "relationship") ui.selectRelationship(String(node.refId));
  else if (node.kind === "note") ui.selectNote(String(node.refId));
  else if (node.kind === "area") ui.selectArea(String(node.refId));
  // Views, enums and types have no ui-store selection yet; they only focus.
  const focused = node.kind === "area-table" || node.kind === "constraint" ? "table" : node.kind;
  emit("focus", {
    kind: focused,
    id: node.kind === "constraint" ? node.parentRefId! : node.refId!,
    ...(node.kind === "field" ? { tableId: node.parentRefId! } : {}),
  });
}

// —— Context menu: rename writes the current layer, delete uses the store ——

const menu = ref<{ x: number; y: number; node: OutlineNode } | null>(null);
const renamingId = ref<string | null>(null);

function openMenu(node: OutlineNode, event: MouseEvent): void {
  if (node.kind === "category" && !creatableCategoryOf(node.category)) return;
  menu.value = { x: event.clientX ?? 0, y: event.clientY ?? 0, node };
}

/** The label of the create entry, or null when the node creates nothing. */
const createLabel = computed(() => {
  const node = menu.value?.node;
  if (!node || node.kind !== "category") return null;
  const category = creatableCategoryOf(node.category);
  if (!category) return null;
  const singular = category.slice(0, -1);
  return t(`add_${singular}`);
});

function commitCreate(): void {
  const node = menu.value?.node;
  menu.value = null;
  if (!node || node.kind !== "category") return;
  const createdId = createOutlineNode(diagramStore, node.category);
  if (!createdId) return;
  expanded.value.add(node.id);
  void reveal(node.id);
}

function startRename(): void {
  if (menu.value) renamingId.value = menu.value.node.id;
  menu.value = null;
}

function commitRename(value: string): void {
  const node = rows.value.find((row) => row.node.id === renamingId.value)?.node;
  renamingId.value = null;
  if (node) renameOutlineNode(diagramStore, node, value, viewState.viewLayer);
}

function commitDelete(): void {
  const node = menu.value?.node;
  menu.value = null;
  if (node) deleteOutlineNode(diagramStore, node);
}

// —— Drag and drop: only table ↔ area (Q11) ——

const dragTableId = ref<string | number | null>(null);

function onDragstart(node: OutlineNode, event: DragEvent): void {
  if (node.kind !== "table") return;
  dragTableId.value = node.refId!;
  event.dataTransfer?.setData("text/plain", String(node.refId));
}

function onDrop(node: OutlineNode): void {
  if (node.kind === "area" && dragTableId.value !== null) {
    // Ruling Q11: membership is geometric — the drop only asks the host
    // (assign-to-area) to move the table into the bounds of the area.
    emit("assign-to-area", { tableId: dragTableId.value, areaId: node.refId! });
  }
  dragTableId.value = null;
}
</script>

<template>
  <div :class="classes.outline" data-testid="outline-tree">
    <div :class="classes.toolbar">
      <input
        v-model="filterText"
        :class="classes.filter"
        data-testid="outline-filter"
        :placeholder="t('outline_filter_placeholder')"
      />
      <button
        type="button"
        :class="classes.sort"
        data-testid="outline-sort-toggle"
        :title="t(sortMode === 'name' ? 'outline_sorted_by_name' : 'outline_creation_order')"
        @click="sortMode = sortMode === 'name' ? 'created' : 'name'"
      >
        {{ sortMode === "name" ? "A–Z" : "#" }}
      </button>
    </div>
    <div v-if="showEmpty" :class="classes.empty" data-testid="outline-empty">
      {{ t("outline_empty") }}
    </div>
    <div
      v-else-if="showNoMatches"
      :class="classes.empty"
      data-testid="outline-no-matches"
    >
      {{ t("outline_no_matches") }}
    </div>
    <div v-else ref="bodyRef" :class="classes.body" @scroll="onScroll">
      <div :style="{ height: `${rows.length * ROW_HEIGHT}px`, position: 'relative' }">
        <div
          v-for="item in windowedRows"
          :key="item.row.node.id"
          :style="{
            position: 'absolute',
            top: `${item.index * ROW_HEIGHT}px`,
            left: 0,
            right: 0,
            height: `${ROW_HEIGHT}px`,
          }"
        >
          <OutlineNodeRow
            :row="item.row"
            :expanded="effectiveExpanded.has(item.row.node.id)"
            :current="item.row.node.id === currentNodeId"
            :renaming="item.row.node.id === renamingId"
            :draggable-row="item.row.node.kind === 'table'"
            @toggle="toggle(item.row.node.id)"
            @select="select(item.row.node)"
            @contextmenu="openMenu(item.row.node, $event)"
            @rename-commit="commitRename"
            @rename-cancel="renamingId = null"
            @dragstart="onDragstart(item.row.node, $event)"
            @drop="onDrop(item.row.node)"
          />
        </div>
      </div>
    </div>
    <OutlineMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      :node="menu.node"
      :create-label="createLabel"
      @close="menu = null"
      @create="commitCreate"
      @rename="startRename"
      @delete="commitDelete"
    />
  </div>
</template>
