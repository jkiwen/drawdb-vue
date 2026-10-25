import { ref, type Ref } from "vue";
import type { RelationshipId } from "@drawdb/core";
import type { ResizeKind, ResizeState } from "./interaction-state.ts";

export type { ResizeKind, ResizeState };

/** The smallest size of a table. */
export const MIN_TABLE_WIDTH = 120;
export const MIN_TABLE_HEIGHT = 60;

/** The smallest size of an area. */
export const MIN_AREA_WIDTH = 80;
export const MIN_AREA_HEIGHT = 60;

/** The smallest size of a note. */
export const MIN_NOTE_WIDTH = 120;
export const MIN_NOTE_HEIGHT = 80;

/** The corner of a table, of an area or of a note that the user grabs. */
export interface ResizeRequest {
  kind: ResizeKind;
  /** The id of the table, of the area or of the note. */
  id: RelationshipId;
  width: number;
  height: number;
}

export interface ResizeApi {
  /** The table, the area or the note that is being resized, or `null`. */
  resizing: Ref<ResizeState | null>;
  /** Starts a resize. */
  begin(request: ResizeRequest): void;
  /** Moves the corner of the element by a delta. */
  move(dw: number, dh: number): void;
  /** Ends the resize. */
  end(): void;
}

/** The smallest size of every element the canvas resizes. */
const SMALLEST: Record<ResizeKind, { width: number; height: number }> = {
  table: { width: MIN_TABLE_WIDTH, height: MIN_TABLE_HEIGHT },
  area: { width: MIN_AREA_WIDTH, height: MIN_AREA_HEIGHT },
  note: { width: MIN_NOTE_WIDTH, height: MIN_NOTE_HEIGHT },
};

/**
 * The resize of a table or of an area. The composable keeps the smallest size,
 * so that the element the user holds never disappears from the canvas.
 */
export function useResize(): ResizeApi {
  const resizing = ref<ResizeState | null>(null);

  function begin(request: ResizeRequest): void {
    resizing.value = {
      kind: request.kind,
      id: request.id,
      width: request.width,
      height: request.height,
    };
  }

  function move(dw: number, dh: number): void {
    const state = resizing.value;
    if (!state) return;

    const smallest = SMALLEST[state.kind];
    resizing.value = {
      ...state,
      width: Math.max(smallest.width, state.width + dw),
      height: Math.max(smallest.height, state.height + dh),
    };
  }

  function end(): void {
    resizing.value = null;
  }

  return { resizing, begin, move, end };
}
