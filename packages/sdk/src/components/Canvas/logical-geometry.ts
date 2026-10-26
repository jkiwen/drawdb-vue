import type { Table } from "@drawdb/core";
import {
  DEFAULT_TABLE_WIDTH,
  type Bounds,
  type GeometryPoint,
} from "./geometry.ts";
import {
  boundsCenter,
  nearestEdgeSide,
  type EdgeAnchor,
} from "./relationship-geometry.ts";

/** The height of an entity box in the logical view. */
export const LOGICAL_TABLE_HEIGHT = 56;

/** The bounds of an entity box in the logical view. */
export function logicalTableBounds(table: Table): Bounds {
  return {
    minX: table.x,
    minY: table.y,
    maxX: table.x + (table.width ?? DEFAULT_TABLE_WIDTH),
    maxY: table.y + LOGICAL_TABLE_HEIGHT,
  };
}

/**
 * The point where a relationship attaches to an entity box.
 *
 * The logical view has no fields, so the relationship attaches to the border
 * of the box instead of to the row of a field.
 */
export function logicalAnchor(
  table: Table,
  side: "left" | "right",
): GeometryPoint {
  return {
    x: side === "right" ? table.x + (table.width ?? DEFAULT_TABLE_WIDTH) : table.x,
    y: table.y + LOGICAL_TABLE_HEIGHT / 2,
  };
}

/**
 * The point where a relationship attaches to an entity box, on the edge
 * nearest to the other end.
 */
export function logicalEdgeAnchor(table: Table, toward: GeometryPoint): EdgeAnchor {
  const bounds = logicalTableBounds(table);
  const side = nearestEdgeSide(bounds, toward);
  if (side === "top" || side === "bottom") {
    return {
      x: Math.min(Math.max(toward.x, bounds.minX), bounds.maxX),
      y: side === "top" ? bounds.minY : bounds.maxY,
      side,
    };
  }
  return { ...logicalAnchor(table, side), side };
}

/** The anchors of a relationship between two entities, start table first. */
export function logicalRelationshipAnchors(
  startTable: Table,
  endTable: Table,
): { start: EdgeAnchor; end: EdgeAnchor } {
  return {
    start: logicalEdgeAnchor(startTable, boundsCenter(logicalTableBounds(endTable))),
    end: logicalEdgeAnchor(endTable, boundsCenter(logicalTableBounds(startTable))),
  };
}

/** The bounds of a relationship between two entities. */
export function logicalRelationshipBounds(
  startTable: Table,
  endTable: Table,
): Bounds {
  const { start, end } = logicalRelationshipAnchors(startTable, endTable);
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}
