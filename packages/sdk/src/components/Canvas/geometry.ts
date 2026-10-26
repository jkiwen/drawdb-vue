import type {
  Area,
  Field,
  FieldId,
  Note,
  Table,
  View,
} from "@drawdb/core";
import {
  tableCommentLines as commentTableLines,
  tableCommentHeight as commentHeight,
} from "./table-comment.ts";
import { tableDetailsHeight } from "./table-details-geometry.ts";

/**
 * Layout helpers of the canvas.
 *
 * The React implementation of drawDB hardcodes the size of a table in the
 * constants of the application. The SDK keeps the same numbers so that a
 * diagram drawn with the SDK and one drawn with the React application look
 * identical.
 */
export const DEFAULT_TABLE_WIDTH = 220;
export const TABLE_HEADER_HEIGHT = 50;
export const TABLE_FIELD_HEIGHT = 36;
export const TABLE_COLOR_STRIP_HEIGHT = 7;
export const DEFAULT_NOTE_WIDTH = 220;
export const DEFAULT_NOTE_HEIGHT = 120;
export const DEFAULT_VIEW_WIDTH = 240;
export const DEFAULT_VIEW_HEIGHT = 80;
export const DEFAULT_VIEWPORT_WIDTH = 1200;
export const DEFAULT_VIEWPORT_HEIGHT = 800;
export const DEFAULT_GRID_SIZE = 10;

/** The height of the title bar a collapsed area is drawn with. */
export const COLLAPSED_AREA_HEIGHT = 28;

export {
  TABLE_DETAILS_PADDING_Y,
  TABLE_DETAILS_ROW_HEIGHT,
  TABLE_DETAILS_SECTION_HEIGHT,
  tableDetailsHeight,
} from "./table-details-geometry.ts";

export interface GeometryPoint {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type CardinalitySide = "one" | "many";

export interface CardinalitySides {
  start: CardinalitySide;
  end: CardinalitySide;
}

export function tableWidth(table: Table): number {
  return table.width && table.width > 0 ? table.width : DEFAULT_TABLE_WIDTH;
}

/**
 * The number of lines the comment of a table takes.
 *
 * The comment is wrapped at the width of the table, so the number of lines
 * depends on the width of the table.
 */
export function tableCommentLines(table: Table): number {
  return commentTableLines(table);
}

/**
 * The height the comment of a table adds to its header.
 */
export function tableCommentHeight(table: Table): number {
  return commentHeight(table);
}

/**
 * The height of the header of a table.
 *
 * The header holds the colour strip, the name and the comment of the table.
 */
export function tableHeaderHeight(table: Table): number {
  return TABLE_HEADER_HEIGHT + commentHeight(table);
}

export function tableHeight(table: Table): number {
  if (table.collapsed) {
    return tableHeaderHeight(table);
  }
  return (
    tableHeaderHeight(table) +
    table.fields.length * TABLE_FIELD_HEIGHT +
    tableDetailsHeight(table)
  );
}

export function tableBounds(table: Table): Bounds {
  return {
    minX: table.x,
    minY: table.y,
    maxX: table.x + tableWidth(table),
    maxY: table.y + tableHeight(table),
  };
}

/** The height of an entity box in the logical view. */
export {
  LOGICAL_TABLE_HEIGHT,
  logicalAnchor,
  logicalEdgeAnchor,
  logicalRelationshipAnchors,
  logicalRelationshipBounds,
  logicalTableBounds,
} from "./logical-geometry.ts";

export {
  boundsCenter,
  collapsedAreaAnchor,
  nearestEdgeSide,
  relationshipAnchors,
  relationshipBounds,
  relationshipPath,
  tableEdgeAnchor,
} from "./relationship-geometry.ts";
export type {
  EdgeAnchor,
  EdgeSide,
  RelationshipPathOptions,
} from "./relationship-geometry.ts";

export function noteBounds(note: Note): Bounds {
  const width = note.width && note.width > 0 ? note.width : DEFAULT_NOTE_WIDTH;
  const height =
    note.height && note.height > 0 ? note.height : DEFAULT_NOTE_HEIGHT;
  return {
    minX: note.x,
    minY: note.y,
    maxX: note.x + width,
    maxY: note.y + height,
  };
}

export function areaBounds(area: Area): Bounds {
  return {
    minX: area.x,
    minY: area.y,
    maxX: area.x + area.width,
    maxY: area.y + area.height,
  };
}

export function viewBounds(view: View): Bounds {
  const width = view.width && view.width > 0 ? view.width : DEFAULT_VIEW_WIDTH;
  return {
    minX: view.x,
    minY: view.y,
    maxX: view.x + width,
    maxY: view.y + DEFAULT_VIEW_HEIGHT,
  };
}

/** The label of a field, including its size, e.g. `VARCHAR(255)`. */
export function fieldLabel(field: Field): string {
  if (field.size === undefined || field.size === null || field.size === "") {
    return field.type;
  }
  return `${field.type}(${field.size})`;
}

/**
 * The point where a relationship attaches to a table.
 *
 * The anchor sits on the left or the right border of the table, in the row of
 * the field the relationship points at.
 */
export function fieldAnchor(
  table: Table,
  fieldId: FieldId,
  side: "left" | "right",
): GeometryPoint {
  const index = table.fields.findIndex((field) => field.id === fieldId);
  const row = index < 0 ? 0 : index;
  const x = side === "right" ? table.x + tableWidth(table) : table.x;
  const y =
    table.y +
    tableHeaderHeight(table) +
    row * TABLE_FIELD_HEIGHT +
    TABLE_FIELD_HEIGHT / 2;

  return { x, y };
}

/** The sides of a relationship that carry a "one" or a "many" marker. */
export function cardinalitySides(
  cardinality: string | undefined,
): CardinalitySides {
  switch (cardinality) {
    case "one_to_many":
      return { start: "one", end: "many" };
    case "many_to_one":
      return { start: "many", end: "one" };
    default:
      return { start: "one", end: "one" };
  }
}

/**
 * The marker of a cardinality side.
 *
 * "one" is drawn as a perpendicular tick, "many" as a crow's foot.
 */
export { cardinalityMarker, cardinalityText } from "./cardinality.ts";

/** The part of the world that is currently visible. */
export function visibleWorldBounds(
  scrollX: number,
  scrollY: number,
  zoom: number,
  width: number,
  height: number,
): Bounds {
  const safeZoom = zoom > 0 ? zoom : 1;
  return {
    minX: scrollX,
    minY: scrollY,
    maxX: scrollX + width / safeZoom,
    maxY: scrollY + height / safeZoom,
  };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

/** Keeps only the elements that are inside of the visible area. */
export function filterVisible<T>(
  items: T[],
  boundsOf: (item: T) => Bounds,
  world: Bounds,
): T[] {
  return items.filter((item) => boundsIntersect(boundsOf(item), world));
}

/** Rounds a coordinate to the grid, when the grid is enabled. */
export function snap(value: number, gridSize: number): number {
  if (gridSize <= 0) {
    return value;
  }
  return Math.round(value / gridSize) * gridSize;
}
