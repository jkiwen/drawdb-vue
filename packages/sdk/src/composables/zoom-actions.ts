/**
 * The geometry behind "fit the diagram into the canvas", "zoom to the
 * selection" and the percent field of the zoom group (design 6.6).
 *
 * The viewport is the visible canvas in screen pixels; the scroll the ui
 * store keeps is in canvas units (the transform divides it by the zoom), so
 * every helper returns scroll values in canvas units too.
 */
import type { Table } from "@drawdb/core";
import { MAX_ZOOM, MIN_ZOOM } from "../stores/ui.ts";

/** The visible canvas, in screen pixels. */
export interface ViewportSize {
  width: number;
  height: number;
}

/** A box in canvas coordinates. */
export interface ContentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The width a table falls back to when the model does not carry one. */
const FALLBACK_TABLE_WIDTH = 220;

/** The height of the header, and of one field row, in canvas units. */
const TABLE_HEADER_HEIGHT = 50;
const ROW_HEIGHT = 36;

/** The padding around the content when it is fitted, in screen pixels. */
export const FIT_PADDING = 40;

/** The table size the canvas draws, as far as the fit is concerned. */
function sizeOf(table: Table): { width: number; height: number } {
  return {
    width: table.width ?? FALLBACK_TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT + ROW_HEIGHT * (table.fields?.length ?? 0),
  };
}

/** The box that wraps the tables, or null when there is none. */
export function contentBounds(tables: readonly Table[]): ContentBox | null {
  if (tables.length === 0) {
    return null;
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const table of tables) {
    const { width, height } = sizeOf(table);
    left = Math.min(left, table.x);
    top = Math.min(top, table.y);
    right = Math.max(right, table.x + width);
    bottom = Math.max(bottom, table.y + height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The zoom that fits the box into the viewport, inside the zoom bounds. */
export function fitZoom(
  box: ContentBox,
  viewport: ViewportSize,
  options: { padding?: number; min?: number; max?: number } = {},
): number {
  const padding = options.padding ?? FIT_PADDING;
  const min = options.min ?? MIN_ZOOM;
  const max = options.max ?? MAX_ZOOM;
  if (box.width <= 0 || box.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }
  const scale = Math.min(
    (viewport.width - 2 * padding) / box.width,
    (viewport.height - 2 * padding) / box.height,
  );
  return Math.min(max, Math.max(min, scale));
}

/** The scroll that centres the box in the viewport at the given zoom. */
export function fitScroll(
  box: ContentBox,
  viewport: ViewportSize,
  zoom: number,
): { scrollX: number; scrollY: number } {
  return {
    scrollX: box.x - (viewport.width / zoom - box.width) / 2,
    scrollY: box.y - (viewport.height / zoom - box.height) / 2,
  };
}
