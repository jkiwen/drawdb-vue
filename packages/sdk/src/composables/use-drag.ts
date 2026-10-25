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
  /** Snaps the origin and the result of the drag to the grid. */
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

  /** The grid of the drag that is running, and whether it snaps. */
  let gridSize = 10;
  let snapToGrid = false;

  function reset(): void {
    dragState.active = false;
    dragState.origin = null;
    dragState.current = null;
    dragState.delta = { x: 0, y: 0 };
    dragState.ids = [];
  }

  function beginDrag(point: Point, ids: string[], options: DragOptions = {}): void {
    gridSize = options.gridSize ?? 10;
    snapToGrid = options.snapToGrid ?? false;
    const origin = snapToGrid
      ? { x: snap(point.x, gridSize), y: snap(point.y, gridSize) }
      : { x: point.x, y: point.y };

    dragState.active = true;
    dragState.origin = origin;
    dragState.current = { x: point.x, y: point.y };
    dragState.delta = { x: 0, y: 0 };
    dragState.ids = [...ids];
  }

  /**
   * The place the dragged elements would take if the button were released now.
   *
   * The place of the grabbed element is rounded to the grid when the grid is
   * enabled, and the elements that travel with it keep their distance to it.
   * The reference application does the same: the pointer may be between two
   * lines of the grid, and the element lands on the line next to it.
   */
  function targetOf(point: Point): Point {
    const origin = dragState.origin;
    if (!origin) {
      return point;
    }
    if (!snapToGrid) {
      return point;
    }
    return {
      x: snap(point.x - origin.x, gridSize) + origin.x,
      y: snap(point.y - origin.y, gridSize) + origin.y,
    };
  }

  function updateDrag(point: Point): void {
    if (!dragState.active || !dragState.origin) {
      return;
    }
    const target = targetOf(point);
    dragState.current = point;
    dragState.delta = {
      x: target.x - dragState.origin.x,
      y: target.y - dragState.origin.y,
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
