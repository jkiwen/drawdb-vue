import type { TableId } from "@drawdb/core";
import { computed, type ComputedRef } from "vue";
import { useDiagramStore } from "../stores/diagram.ts";

export interface SortableOptions {
  /** The selector of the element the user grabs to move a row. */
  handle?: string;
  /** The duration of the animation of the move, in milliseconds. */
  animation?: number;
  /** The class of the row that is being moved. */
  ghostClass?: string;
}

export interface SortableApi {
  /** The options of `vue-draggable-plus`, ready to be bound with `v-bind`. */
  sortableOptions: ComputedRef<Record<string, unknown>>;
  /** Records the move of a field in the history. */
  onSort(tableId: TableId, fromIndex: number, toIndex: number): void;
}

/**
 * The sorting of the rows of a list.
 *
 * The composable does not change the list itself: it gives the options of the
 * drag and the drop, and it records the result in the history, so that the
 * user can undo the move.
 */
export function useSortable(options: SortableOptions = {}): SortableApi {
  const diagram = useDiagramStore();

  const sortableOptions = computed<Record<string, unknown>>(() => ({
    handle: options.handle ?? ".field-drag-handle",
    animation: options.animation ?? 150,
    ghostClass: options.ghostClass ?? "is-sorting",
  }));

  function onSort(
    tableId: TableId,
    fromIndex: number,
    toIndex: number,
  ): void {
    if (fromIndex === toIndex) {
      return;
    }
    diagram.moveField(tableId, fromIndex, toIndex);
  }

  return { sortableOptions, onSort };
}
