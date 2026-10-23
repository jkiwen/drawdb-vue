import { defineStore } from "pinia";
import { ref } from "vue";

/** A field of a table the user picked. */
export interface SelectedField {
  tableId: string;
  fieldId: string;
}

/**
 * The selection of the canvas: the tables, relationships, notes, areas and
 * fields the user picked, plus the scroll position and the zoom of the
 * viewport. The side panel shares it with the canvas.
 */
export const useSelectionStore = defineStore("selection", () => {
  const selectedTableIds = ref<string[]>([]);
  const selectedRelationshipIds = ref<string[]>([]);
  const selectedNoteIds = ref<string[]>([]);
  const selectedAreaIds = ref<string[]>([]);
  const selectedFields = ref<SelectedField[]>([]);
  const scrollX = ref(0);
  const scrollY = ref(0);
  const zoom = ref(1);

  /** Clears every selection; the canvas does this on a background click. */
  function clearSelection(): void {
    selectedTableIds.value = [];
    selectedRelationshipIds.value = [];
    selectedNoteIds.value = [];
    selectedAreaIds.value = [];
    selectedFields.value = [];
  }

  /** Selects one table, dropping the others. */
  function selectTable(id: string): void {
    selectedTableIds.value = [id];
    selectedRelationshipIds.value = [];
    selectedNoteIds.value = [];
    selectedAreaIds.value = [];
    selectedFields.value = [];
  }

  /** Selects one relationship, dropping the others. */
  function selectRelationship(id: string): void {
    selectedRelationshipIds.value = [id];
    selectedTableIds.value = [];
    selectedNoteIds.value = [];
    selectedAreaIds.value = [];
    selectedFields.value = [];
  }

  /** Selects one field of a table, dropping the other selections. */
  function selectField(tableId: string, fieldId: string): void {
    selectedTableIds.value = [tableId];
    selectedFields.value = [{ tableId, fieldId }];
    selectedRelationshipIds.value = [];
    selectedNoteIds.value = [];
    selectedAreaIds.value = [];
  }

  /** Selects one note, dropping the others. */
  function selectNote(id: string): void {
    selectedNoteIds.value = [id];
    selectedTableIds.value = [];
    selectedRelationshipIds.value = [];
    selectedAreaIds.value = [];
    selectedFields.value = [];
  }

  /** Selects one area, dropping the others. */
  function selectArea(id: string): void {
    selectedAreaIds.value = [id];
    selectedTableIds.value = [];
    selectedRelationshipIds.value = [];
    selectedNoteIds.value = [];
    selectedFields.value = [];
  }

  return {
    selectedTableIds,
    selectedRelationshipIds,
    selectedNoteIds,
    selectedAreaIds,
    selectedFields,
    scrollX,
    scrollY,
    zoom,
    clearSelection,
    selectTable,
    selectRelationship,
    selectField,
    selectNote,
    selectArea,
  };
});
