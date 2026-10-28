import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ViewMode } from "../types/sdk-options.ts";
import type {
  LinkingState,
  ResizeState,
  SelectionBox,
} from "../components/Canvas/interactions/interaction-state.ts";
import { useFocusIssue } from "./selection-actions.ts";
import { useViewStateStore } from "./view-state.ts";

export type UiTab =
  | "tables"
  | "relationships"
  | "notes"
  | "areas"
  | "enums"
  | "views"
  | "types"
  | "customTypes"
  | "sqlHeader"
  | "issues";

/** A transient message the editor shows once, for example a new error. */
export interface UiNotification {
  id: number;
  text: string;
}

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

// The zoom range of design 6.6: 10% to 400%.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
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
  /**
   * The layer the canvas renders: the view-state store owns it (it is document
   * data, section 9.2), this store only mirrors it for the older surface (the
   * menu entry and the `viewMode` prop of the editor).
   */
  const viewMode = computed<ViewMode>(() => useViewStateStore().viewLayer);
  const contextMenu = ref<ContextMenuState | null>(null);
  const isFullscreen = ref(false);
  // The one-time toast of the bottom panel (ruling Q9: new errors never
  // auto expand the panel, they raise a badge and a single notification).
  const lastNotification = ref<UiNotification | null>(null);
  let notificationSeq = 0;
  // The state of the interactions of the canvas. The composables of the
  // canvas keep the behaviour, the store holds the state.
  const linking = ref<LinkingState | null>(null);
  const resizing = ref<ResizeState | null>(null);
  const selectionBox = ref<SelectionBox | null>(null);

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
      (field: SelectedField) => field.tableId === tableId && field.fieldId === fieldId,
    );
    if (exists) {
      selectedFields.value = selectedFields.value.filter(
        (field: SelectedField) =>
          !(field.tableId === tableId && field.fieldId === fieldId),
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
    useViewStateStore().setViewLayer(mode);
  }

  /** Switches to the other view mode. */
  function toggleViewMode(): void {
    setViewMode(viewMode.value === "physical" ? "logical" : "physical");
  }
  function openContextMenu(state: ContextMenuState): void {
    contextMenu.value = state;
  }

  function closeContextMenu(): void {
    contextMenu.value = null;
  }

  /** Whether the editor of the host is on the whole screen. */
  function setFullscreen(value: boolean): void {
    isFullscreen.value = value;
  }

  /** Raises a one-time notification; the newest one replaces the previous. */
  function notify(text: string): void {
    notificationSeq += 1;
    lastNotification.value = { id: notificationSeq, text };
  }

  /** Dismisses the current notification. */
  function clearNotification(): void {
    lastNotification.value = null;
  }

  // Selects the object a problem of the diagram is about and scrolls to it.
  // The callback keeps the viewport of this store in step with the move.
  const focusIssue = useFocusIssue((x, y) => {
    scrollX.value = x;
    scrollY.value = y;
  });

  return {
    selectedTableIds,
    selectedRelationshipIds,
    selectedNoteIds,
    selectedAreaIds,
    selectedFields,
    zoom, scrollX, scrollY,
    activeTab,
    sidebarOpen,
    showGrid,
    snapToGrid,
    showMinimap,
    searchTerm,
    viewMode,
    contextMenu,
    isFullscreen,
    lastNotification,
    linking,
    resizing,
    selectionBox,
    hasSelection,
    clearSelection,
    selectTable, selectRelationship, selectNote, selectArea, selectField,
    setZoom, zoomIn, zoomOut, resetView,
    setActiveTab,
    toggleSidebar,
    toggleGrid,
    toggleSnapToGrid,
    toggleMinimap,
    setSearchTerm,
    setViewMode, toggleViewMode,
    openContextMenu,
    closeContextMenu,
    setFullscreen,
    notify,
    clearNotification,
    focusIssue,
  };
});

export type UIStore = ReturnType<typeof useUIStore>;
