import { computed, type ComputedRef } from "vue";
import { useDiagramStore } from "../stores/diagram.ts";
import { useUIStore, type SelectedField } from "../stores/ui.ts";
import { resolvePinia } from "./pinia.ts";

export type SelectionKind = "table" | "relationship" | "note" | "area";

export interface SelectionOptions {
  /** Keeps the current selection instead of replacing it. */
  additive?: boolean;
  /** Overrides the kind that is resolved from the diagram. */
  kind?: SelectionKind;
}

export interface SelectionApi {
  /** Ids of every selected entity, in the order they were selected. */
  selectedIds: ComputedRef<string[]>;
  selectedTables: ComputedRef<string[]>;
  selectedRelationships: ComputedRef<string[]>;
  selectedNotes: ComputedRef<string[]>;
  selectedAreas: ComputedRef<string[]>;
  selectedFields: ComputedRef<SelectedField[]>;
  hasSelection: ComputedRef<boolean>;
  kindOf(id: string): SelectionKind;
  isSelected(id: string): boolean;
  select(id: string, options?: SelectionOptions): void;
  deselect(id: string): void;
  toggle(id: string, options?: SelectionOptions): void;
  selectMany(ids: string[], options?: SelectionOptions): void;
  clear(): void;
}

/**
 * Selection state of the canvas.
 *
 * The selection itself lives in the UI store, so that every component of the
 * editor sees the same selection; this composable is the API the components
 * use to change it.
 */
export function useSelection(): SelectionApi {
  const pinia = resolvePinia();
  const ui = useUIStore(pinia);
  const diagram = useDiagramStore(pinia);

  const selectedIds = computed<string[]>(() => [
    ...ui.selectedTableIds,
    ...ui.selectedRelationshipIds,
    ...ui.selectedNoteIds,
    ...ui.selectedAreaIds,
  ]);

  const selectedTables = computed<string[]>(() => ui.selectedTableIds);
  const selectedRelationships = computed<string[]>(() => ui.selectedRelationshipIds);
  const selectedNotes = computed<string[]>(() => ui.selectedNoteIds);
  const selectedAreas = computed<string[]>(() => ui.selectedAreaIds);
  const selectedFields = computed<SelectedField[]>(() => ui.selectedFields);
  const hasSelection = computed<boolean>(() => ui.hasSelection);

  /** Resolves the kind of an id by looking it up in the diagram. */
  function kindOf(id: string): SelectionKind {
    if (diagram.tableById(id)) {
      return "table";
    }
    if (diagram.relationshipById(id)) {
      return "relationship";
    }
    if (diagram.notes.some((note) => note.id === id)) {
      return "note";
    }
    if (diagram.areas.some((area) => area.id === id)) {
      return "area";
    }
    // Unknown ids are treated as tables, which is what the sidebar produces.
    return "table";
  }

  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id);
  }

  function clear(): void {
    ui.clearSelection();
  }

  function addTo(list: string[], id: string): string[] {
    return list.includes(id) ? list : [...list, id];
  }

  function select(id: string, options: SelectionOptions = {}): void {
    const kind = options.kind ?? kindOf(id);
    const additive = options.additive ?? false;

    if (!additive) {
      clear();
    }

    switch (kind) {
      case "relationship":
        ui.selectedRelationshipIds = addTo(ui.selectedRelationshipIds, id);
        break;
      case "note":
        ui.selectedNoteIds = addTo(ui.selectedNoteIds, id);
        break;
      case "area":
        ui.selectedAreaIds = addTo(ui.selectedAreaIds, id);
        break;
      default:
        ui.selectedTableIds = addTo(ui.selectedTableIds, id);
        break;
    }
  }

  function deselect(id: string): void {
    ui.selectedTableIds = ui.selectedTableIds.filter((item) => item !== id);
    ui.selectedRelationshipIds = ui.selectedRelationshipIds.filter(
      (item) => item !== id,
    );
    ui.selectedNoteIds = ui.selectedNoteIds.filter((item) => item !== id);
    ui.selectedAreaIds = ui.selectedAreaIds.filter((item) => item !== id);
    ui.selectedFields = ui.selectedFields.filter(
      (field) => field.tableId !== id && field.fieldId !== id,
    );
  }

  function toggle(id: string, options: SelectionOptions = {}): void {
    if (isSelected(id)) {
      deselect(id);
      return;
    }
    select(id, options);
  }

  function selectMany(ids: string[], options: SelectionOptions = {}): void {
    if (!options.additive) {
      clear();
    }
    for (const id of ids) {
      select(id, { ...options, additive: true });
    }
  }

  return {
    selectedIds,
    selectedTables,
    selectedRelationships,
    selectedNotes,
    selectedAreas,
    selectedFields,
    hasSelection,
    kindOf,
    isSelected,
    select,
    deselect,
    toggle,
    selectMany,
    clear,
  };
}
