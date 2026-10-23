import { reactive } from "vue";
import type { Point } from "./use-viewport.ts";

export interface DragState {
  /** True while a drag is in progress. */
  active: boolean;
  /** The point the drag started at, in canvas coordinates. */
  origin: Point | null;
  /** The latest pointer position, in canvas coordinates. */
  current: Point | null;
  /** The movement since the drag started. */
  delta: Point;
  /** The ids that are being dragged. */
  ids: string[];
}

export interface DragOptions {
  /** Snaps the origin to the grid. */
  snapToGrid?: boolean;
  /** The size of the grid in canvas units. */
  gridSize?: number;
}

export interface DragResult {
  ids: string[];
  delta: Point;
}

export interface DragApi {
  dragState: DragState;
  beginDrag(point: Point, ids: string[], options?: DragOptions): void;
  updateDrag(point: Point): void;
  endDrag(): DragResult | null;
  cancelDrag(): void;
}

function snap(value: number, gridSize: number): number {
  if (gridSize <= 0) {
    return value;
  }
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Drag state of the canvas.
 *
 * The composable only tracks the movement; applying it to the diagram is the
 * job of the caller, which turns the result into a core command so that the
 * move can be undone.
 */
export function useDrag(): DragApi {
  const dragState = reactive<DragState>({
    active: false,
    origin: null,
    current: null,
    delta: { x: 0, y: 0 },
    ids: [],
  });

  function reset(): void {
    dragState.active = false;
    dragState.origin = null;
    dragState.current = null;
    dragState.delta = { x: 0, y: 0 };
    dragState.ids = [];
  }

  function beginDrag(point: Point, ids: string[], options: DragOptions = {}): void {
    const gridSize = options.gridSize ?? 10;
    const origin = options.snapToGrid
      ? { x: snap(point.x, gridSize), y: snap(point.y, gridSize) }
      : { x: point.x, y: point.y };

    dragState.active = true;
    dragState.origin = origin;
    dragState.current = { x: point.x, y: point.y };
    dragState.delta = { x: 0, y: 0 };
    dragState.ids = [...ids];
  }

  function updateDrag(point: Point): void {
    if (!dragState.active || !dragState.origin) {
      return;
    }
    dragState.current = { x: point.x, y: point.y };
    dragState.delta = {
      x: point.x - dragState.origin.x,
      y: point.y - dragState.origin.y,
    };
  }

  function endDrag(): DragResult | null {
    if (!dragState.active) {
      return null;
    }
    const result: DragResult = {
      ids: [...dragState.ids],
      delta: { x: dragState.delta.x, y: dragState.delta.y },
    };
    reset();
    return result;
  }

  function cancelDrag(): void {
    reset();
  }

  return { dragState, beginDrag, updateDrag, endDrag, cancelDrag };
}
