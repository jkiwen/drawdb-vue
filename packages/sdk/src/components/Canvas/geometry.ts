import type {
  Area,
  Field,
  FieldId,
  Note,
  Relationship,
  Table,
  View,
} from "@drawdb/core";

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

export function tableHeight(table: Table): number {
  if (table.collapsed) {
    return TABLE_HEADER_HEIGHT;
  }
  return TABLE_HEADER_HEIGHT + table.fields.length * TABLE_FIELD_HEIGHT;
}

export function tableBounds(table: Table): Bounds {
  return {
    minX: table.x,
    minY: table.y,
    maxX: table.x + tableWidth(table),
    maxY: table.y + tableHeight(table),
  };
}

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
    TABLE_HEADER_HEIGHT +
    row * TABLE_FIELD_HEIGHT +
    TABLE_FIELD_HEIGHT / 2;

  return { x, y };
}

/** The anchors of a relationship, start table first. */
export function relationshipAnchors(
  relationship: Relationship,
  startTable: Table,
  endTable: Table,
): { start: GeometryPoint; end: GeometryPoint } {
  const startSide = startTable.x <= endTable.x ? "right" : "left";
  const endSide = startSide === "right" ? "left" : "right";

  return {
    start: fieldAnchor(startTable, relationship.startFieldId, startSide),
    end: fieldAnchor(endTable, relationship.endFieldId, endSide),
  };
}

export function relationshipBounds(
  relationship: Relationship,
  startTable: Table,
  endTable: Table,
): Bounds {
  const { start, end } = relationshipAnchors(relationship, startTable, endTable);
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}

/** A cubic bezier between two anchors, drawn as a horizontal S curve. */
export function relationshipPath(start: GeometryPoint, end: GeometryPoint): string {
  const distance = Math.abs(end.x - start.x);
  const control = Math.max(40, distance / 2);

  return [
    `M ${start.x} ${start.y}`,
    `C ${start.x + control} ${start.y}, ${end.x - control} ${end.y}, ${end.x} ${end.y}`,
  ].join(" ");
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
export function cardinalityMarker(
  side: CardinalitySide,
  at: GeometryPoint,
  direction: "left" | "right",
): string {
  const dir = direction === "right" ? 1 : -1;

  if (side === "many") {
    return [
      `M ${at.x} ${at.y} l ${8 * dir} -7`,
      `M ${at.x} ${at.y} l ${8 * dir} 0`,
      `M ${at.x} ${at.y} l ${8 * dir} 7`,
    ].join(" ");
  }

  return [
    `M ${at.x} ${at.y} l ${8 * dir} -6`,
    `M ${at.x} ${at.y} l ${8 * dir} 6`,
  ].join(" ");
}

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
