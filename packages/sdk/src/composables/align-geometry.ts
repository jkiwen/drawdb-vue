
/**
 * The alignment of the canvas via the toolbar (design 6.5). The geometry
 * lives in pure functions so it is testable without a store, and the move is
 * one AutoArrangeCommand, so one undo puts every table back.
 */

export type AlignMode =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "center-h"
  | "center-v";
export type DistributeAxis = "horizontal" | "vertical";

/** The box of a table that an alignment works with. */
export interface AlignBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The left, right and centre edges of the selection. */
function spans(boxes: readonly AlignBox[]) {
  return {
    left: Math.min(...boxes.map((box) => box.x)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    top: Math.min(...boxes.map((box) => box.y)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height)),
  };
}

/**
 * Aligns the boxes to one edge (or to the centre line) of their common
 * bounding box. Fewer than two boxes have nothing to align to and keep
 * their coordinates.
 */
export function alignBoxes(
  boxes: readonly AlignBox[],
  mode: AlignMode,
): { id: string; x: number; y: number }[] {
  if (boxes.length < 2) return boxes.map((box) => ({ id: box.id, x: box.x, y: box.y }));

  const { left, right, top, bottom } = spans(boxes);
  return boxes.map((box) => {
    switch (mode) {
      case "left":
        return { id: box.id, x: left, y: box.y };
      case "right":
        return { id: box.id, x: right - box.width, y: box.y };
      case "top":
        return { id: box.id, x: box.x, y: top };
      case "bottom":
        return { id: box.id, x: box.x, y: bottom - box.height };
      case "center-h":
        return { id: box.id, x: (left + right) / 2 - box.width / 2, y: box.y };
      case "center-v":
        return { id: box.id, x: box.x, y: (top + bottom) / 2 - box.height / 2 };
    }
  });
}

/**
 * Spreads the boxes so the gaps between them are equal, keeping the first
 * and the last one where they are. Three boxes (the two ends plus one in
 * between) are the minimum; fewer keep their coordinates.
 */
export function distributeBoxes(
  boxes: readonly AlignBox[],
  axis: DistributeAxis,
): { id: string; x: number; y: number }[] {
  const keep = () => boxes.map((box) => ({ id: box.id, x: box.x, y: box.y }));
  if (boxes.length < 3) return keep();

  const start = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const sorted = [...boxes].sort((a, b) => a[start] - b[start]);

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const totalSize = sorted.reduce((sum, box) => sum + box[size], 0);
  const span = last[start] + last[size] - first[start];
  const gap = (span - totalSize) / (sorted.length - 1);

  const moved = new Map<string, number>();
  let cursor = first[start];
  for (const box of sorted) {
    moved.set(box.id, cursor);
    cursor += box[size] + gap;
  }

  return boxes.map((box) => {
    const value = moved.get(box.id) ?? box[start];
    return axis === "horizontal"
      ? { id: box.id, x: value, y: box.y }
      : { id: box.id, x: box.x, y: value };
  });
}
