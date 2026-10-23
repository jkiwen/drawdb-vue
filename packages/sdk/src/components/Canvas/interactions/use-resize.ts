import { ref, type Ref } from "vue";
import type { RelationshipId } from "@drawdb/core";
import type { ResizeState } from "./interaction-state.ts";

export type { ResizeState };

/** The smallest size of a table. */
export const MIN_TABLE_WIDTH = 120;
export const MIN_TABLE_HEIGHT = 60;

export interface ResizeApi {
  /** The table that is being resized, or `null`. */
  resizing: Ref<ResizeState | null>;
  /** Starts a resize. */
  begin(tableId: RelationshipId, width: number, height: number): void;
  /** Moves the corner of the table by a delta. */
  move(dw: number, dh: number): void;
  /** Ends the resize. */
  end(): void;
}

/**
 * The resize of a table. The composable keeps the smallest size, so that a
 * table never disappears.
 */
export function useResize(): ResizeApi {
  const resizing = ref<ResizeState | null>(null);

  function begin(
    tableId: RelationshipId,
    width: number,
    height: number,
  ): void {
    resizing.value = { tableId, width, height };
  }

  function move(dw: number, dh: number): void {
    if (!resizing.value) return;

    resizing.value = {
      ...resizing.value,
      width: Math.max(MIN_TABLE_WIDTH, resizing.value.width + dw),
      height: Math.max(MIN_TABLE_HEIGHT, resizing.value.height + dh),
    };
  }

  function end(): void {
    resizing.value = null;
  }

  return { resizing, begin, move, end };
}
