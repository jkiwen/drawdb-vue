import { ref, type Ref } from "vue";
import type { Table } from "@drawdb/core";
import { tableBounds } from "../geometry.ts";
import type { SelectionBox } from "./interaction-state.ts";

export type { SelectionBox };

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionBoxApi {
  /** The rectangle that is being drawn. */
  box: Ref<SelectionBox>;
  /** Starts a rectangle. */
  begin(point: { x: number; y: number }): void;
  /** Moves the corner of the rectangle. */
  move(point: { x: number; y: number }): void;
  /** Ends the rectangle. */
  end(): void;
  /** The ids of the tables that the rectangle touches. */
  idsIn(rect: SelectionRect, tables: Table[]): (string | number)[];
}

/** The rectangle between two points. */
export function rectBetween(
  origin: { x: number; y: number },
  current: { x: number; y: number },
): SelectionRect {
  return {
    x: Math.min(origin.x, current.x),
    y: Math.min(origin.y, current.y),
    width: Math.abs(current.x - origin.x),
    height: Math.abs(current.y - origin.y),
  };
}

/** True when two rectangles touch each other. */
function intersects(
  left: { minX: number; minY: number; maxX: number; maxY: number },
  right: SelectionRect,
): boolean {
  return (
    left.minX <= right.x + right.width &&
    left.maxX >= right.x &&
    left.minY <= right.y + right.height &&
    left.maxY >= right.y
  );
}

/**
 * The rectangle that the user draws on the canvas to select several tables
 * at once.
 */
export function useSelectionBox(): SelectionBoxApi {
  const box = ref<SelectionBox>({
    active: false,
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
  });

  function begin(point: { x: number; y: number }): void {
    box.value = {
      active: true,
      origin: { x: point.x, y: point.y },
      current: { x: point.x, y: point.y },
    };
  }

  function move(point: { x: number; y: number }): void {
    if (!box.value.active) return;
    box.value.current = { x: point.x, y: point.y };
  }

  function end(): void {
    if (!box.value.active) return;
    box.value.active = false;
  }

  function idsIn(rect: SelectionRect, tables: Table[]): (string | number)[] {
    return tables
      .filter((table) => intersects(tableBounds(table), rect))
      .map((table) => table.id);
  }

  return { box, begin, move, end, idsIn };
}
