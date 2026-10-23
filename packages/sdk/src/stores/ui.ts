import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ViewMode } from "../types/sdk-options.ts";

export type UiTab =
  | "tables"
  | "relationships"
  | "notes"
  | "areas"
  | "enums"
  | "views"
  | "types";

export interface SelectedField {
  tableId: string;
  fieldId: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  target:
    | { kind: "canvas" }
    | { kind: "table"; id: string }
    | { kind: "field"; tableId: string; fieldId: string }
    | { kind: "relationship"; id: string }
    | { kind: "note"; id: string };
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

/**
 * Ephemeral editor state: selection, viewport and panel visibility.
 *
 * Nothing in this store is persisted; it only describes what the user is
 * currently looking at.
 */
export const useUIStore = defineStore("ui", () => {
  const selectedTableIds = ref<string[]>([]);
  const selectedRelationshipIds = ref<string[]>([]);
  const selectedNoteIds = ref<string[]>([]);
  const selectedAreaIds = ref<string[]>([]);
  const selectedFields = ref<SelectedField[]>([]);

  const zoom = ref(1);
  const scrollX = ref(0);
  const scrollY = ref(0);

  const activeTab = ref<UiTab>("tables");
  const sidebarOpen = ref(true);
  const showGrid = ref(true);
  const snapToGrid = ref(true);
  const showMinimap = ref(false);
  const searchTerm = ref("");
  const viewMode = ref<ViewMode>("physical");
  const contextMenu = ref<ContextMenuState | null>(null);

  const hasSelection = computed(
    () =>
      selectedTableIds.value.length > 0 ||
      selectedRelationshipIds.value.length > 0 ||
      selectedNoteIds.value.length > 0 ||
      selectedAreaIds.value.length > 0 ||
      selectedFields.value.length > 0,
  );

  function clearSelection(): void {
    selectedTableIds.value = [];
    selectedRelationshipIds.value = [];
    selectedNoteIds.value = [];
    selectedAreaIds.value = [];
    selectedFields.value = [];
  }

  function selectTable(id: string, additive = false): void {
    if (!additive) {
      clearSelection();
    }
    if (
      additive &&
      selectedTableIds.value.includes(id) &&
      !selectedFields.value.length
    ) {
      selectedTableIds.value = selectedTableIds.value.filter(
        (tableId) => tableId !== id,
      );
      return;
    }
    if (!selectedTableIds.value.includes(id)) {
      selectedTableIds.value = [...selectedTableIds.value, id];
    }
  }

  function selectRelationship(id: string, additive = false): void {
    if (!additive) {
      clearSelection();
    }
    selectedRelationshipIds.value = additive
      ? selectedRelationshipIds.value.includes(id)
        ? selectedRelationshipIds.value.filter((item) => item !== id)
        : [...selectedRelationshipIds.value, id]
      : [id];
  }

  function selectNote(id: string, additive = false): void {
    if (!additive) {
      clearSelection();
    }
    selectedNoteIds.value = additive
      ? selectedNoteIds.value.includes(id)
        ? selectedNoteIds.value.filter((item) => item !== id)
        : [...selectedNoteIds.value, id]
      : [id];
  }

  function selectArea(id: string, additive = false): void {
    if (!additive) {
      clearSelection();
    }
    selectedAreaIds.value = additive
      ? selectedAreaIds.value.includes(id)
        ? selectedAreaIds.value.filter((item) => item !== id)
        : [...selectedAreaIds.value, id]
      : [id];
  }

  function selectField(tableId: string, fieldId: string, additive = false): void {
    if (!additive) {
      clearSelection();
    }
    const exists = selectedFields.value.some(
      (field) => field.tableId === tableId && field.fieldId === fieldId,
    );
    if (exists) {
      selectedFields.value = selectedFields.value.filter(
        (field) => !(field.tableId === tableId && field.fieldId === fieldId),
      );
      return;
    }
    selectedFields.value = [...selectedFields.value, { tableId, fieldId }];
  }

  function setZoom(value: number): void {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function zoomIn(): void {
    setZoom(zoom.value + ZOOM_STEP);
  }

  function zoomOut(): void {
    setZoom(zoom.value - ZOOM_STEP);
  }

  function resetView(): void {
    zoom.value = 1;
    scrollX.value = 0;
    scrollY.value = 0;
  }

  function setActiveTab(tab: UiTab): void {
    activeTab.value = tab;
  }

  function toggleSidebar(value?: boolean): void {
    sidebarOpen.value = value ?? !sidebarOpen.value;
  }

  function toggleGrid(value?: boolean): void {
    showGrid.value = value ?? !showGrid.value;
  }

  function toggleSnapToGrid(value?: boolean): void {
    snapToGrid.value = value ?? !snapToGrid.value;
  }

  function toggleMinimap(value?: boolean): void {
    showMinimap.value = value ?? !showMinimap.value;
  }

  function setSearchTerm(value: string): void {
    searchTerm.value = value;
  }

  /** Switches between the physical and the logical view. */
  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode;
  }

  /** Switches to the other view mode. */
  function toggleViewMode(): void {
    viewMode.value = viewMode.value === "physical" ? "logical" : "physical";
  }

  function openContextMenu(state: ContextMenuState): void {
    contextMenu.value = state;
  }

  function closeContextMenu(): void {
    contextMenu.value = null;
  }

  return {
    selectedTableIds,
    selectedRelationshipIds,
    selectedNoteIds,
    selectedAreaIds,
    selectedFields,
    zoom,
    scrollX,
    scrollY,
    activeTab,
    sidebarOpen,
    showGrid,
    snapToGrid,
    showMinimap,
    searchTerm,
    viewMode,
    contextMenu,
    hasSelection,
    clearSelection,
    selectTable,
    selectRelationship,
    selectNote,
    selectArea,
    selectField,
    setZoom,
    zoomIn,
    zoomOut,
    resetView,
    setActiveTab,
    toggleSidebar,
    toggleGrid,
    toggleSnapToGrid,
    toggleMinimap,
    setSearchTerm,
    setViewMode,
    toggleViewMode,
    openContextMenu,
    closeContextMenu,
  };
});

export type UIStore = ReturnType<typeof useUIStore>;
