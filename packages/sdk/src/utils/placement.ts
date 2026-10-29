import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  TABLE_HEADER_HEIGHT,
} from "../components/Canvas/geometry.ts";

/**
 * Where a new element of the canvas lands.
 *
 * A new table, note or area has to appear where the reader is looking: the
 * middle of the visible area, in the coordinates of the diagram. It cannot
 * land at the same point twice, so each element is shifted by a step, and the
 * shift starts over after five elements instead of walking off the screen.
 */

export interface PlacementViewport {
  width: number;
  height: number;
}

export interface PlacementSize {
  width: number;
  height: number;
}

export interface PlacementScroll {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface PlacementPoint {
  x: number;
  y: number;
}

/** The size an empty table starts with: the header, no fields yet. */
export const NEW_TABLE_SIZE: PlacementSize = {
  width: 220,
  height: TABLE_HEADER_HEIGHT,
};

export const NEW_NOTE_SIZE: PlacementSize = {
  width: DEFAULT_NOTE_WIDTH,
  height: DEFAULT_NOTE_HEIGHT,
};

export const NEW_AREA_SIZE: PlacementSize = { width: 240, height: 160 };

/** The offset between two elements that are added one after the other. */
export const CASCADE_STEP = 24;

/** Fallback of the middle of the visible area before the canvas is measured. */
export const FALLBACK_CENTRE: PlacementPoint = { x: 100, y: 100 };

/**
 * The point of the diagram that sits in the middle of the visible canvas.
 *
 * The canvas maps a point of the diagram to the screen with
 * `(point - scroll) * zoom`, so the inverse of the middle of the viewport is
 * `scroll + viewport / (2 * zoom)`.
 */
export function centreOfViewport(
  view: PlacementScroll & { viewport: PlacementViewport; fallback?: PlacementPoint },
): PlacementPoint {
  const fallback = view.fallback ?? FALLBACK_CENTRE;
  if (view.viewport.width <= 0 || view.viewport.height <= 0) {
    return { ...fallback };
  }
  const zoom = view.zoom > 0 ? view.zoom : 1;
  return {
    x: view.scrollX + view.viewport.width / (2 * zoom),
    y: view.scrollY + view.viewport.height / (2 * zoom),
  };
}

/** The top left corner that puts the centre of the element on the point. */
export function placeAt(
  centre: PlacementPoint,
  size: PlacementSize,
  shift = 0,
): PlacementPoint {
  return {
    x: centre.x - size.width / 2 + shift,
    y: centre.y - size.height / 2 + shift,
  };
}

/** How far the next element of a kind is moved so it does not stack. */
export function cascadeShift(taken: number): number {
  return taken * CASCADE_STEP;
}
