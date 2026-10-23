import type { Table } from "@drawdb/core";
import {
  DEFAULT_TABLE_WIDTH,
  type Bounds,
  type GeometryPoint,
} from "./geometry.ts";

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

/** The anchors of a relationship between two entities, start table first. */
export function logicalRelationshipAnchors(
  startTable: Table,
  endTable: Table,
): { start: GeometryPoint; end: GeometryPoint } {
  const startSide = startTable.x <= endTable.x ? "right" : "left";
  const endSide = startSide === "right" ? "left" : "right";

  return {
    start: logicalAnchor(startTable, startSide),
    end: logicalAnchor(endTable, endSide),
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
