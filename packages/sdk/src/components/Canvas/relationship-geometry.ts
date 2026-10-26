import type { Area, FieldId, Relationship, Table } from "@drawdb/core";
import {
  COLLAPSED_AREA_HEIGHT,
  fieldAnchor,
  tableBounds,
  type Bounds,
  type GeometryPoint,
} from "./geometry.ts";
import {
  containsPoint,
  curveCrosses,
  detourPath,
  unionObstacles,
} from "./relationship-detour.ts";

/**
 * The geometry of a relationship: the anchors it attaches with and the path
 * between them.
 *
 * An anchor sits on the edge of its box nearest to the other end — on the row
 * of the field for the left and right edges of a table, on the middle of the
 * top and bottom edges otherwise. A path whose bezier would cross a table or
 * an area that holds neither end is rerouted around the obstacle.
 */

/** A side of the box an anchor sits on. */
export type EdgeSide = "left" | "right" | "top" | "bottom";

/** An anchor on the border of a box, with the side it sits on. */
export interface EdgeAnchor extends GeometryPoint {
  side: EdgeSide;
}

/** How the path between two anchors is drawn. */
export interface RelationshipPathOptions {
  startSide?: EdgeSide;
  endSide?: EdgeSide;
  obstacles?: Bounds[];
}

/** The direction an anchor faces, by the side it sits on. */
const EDGE_NORMALS: Record<EdgeSide, GeometryPoint> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

/** The center of a box. */
export function boundsCenter(bounds: Bounds): GeometryPoint {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The side of a box nearest to a point: the axis with the dominant offset. */
export function nearestEdgeSide(from: Bounds, toward: GeometryPoint): EdgeSide {
  const center = boundsCenter(from);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

/**
 * The point where a relationship attaches to a table, on the edge nearest to
 * the other end.
 *
 * The left and right edges anchor on the row of the field the relationship
 * points at; the top and bottom edges anchor across from the other end.
 */
export function tableEdgeAnchor(
  table: Table,
  fieldId: FieldId,
  toward: GeometryPoint,
): EdgeAnchor {
  const bounds = tableBounds(table);
  const side = nearestEdgeSide(bounds, toward);
  if (side === "left" || side === "right") {
    return { ...fieldAnchor(table, fieldId, side), side };
  }
  return {
    x: clamp(toward.x, bounds.minX, bounds.maxX),
    y: side === "top" ? bounds.minY : bounds.maxY,
    side,
  };
}

/**
 * The point where a relationship attaches to a collapsed area: the edge of
 * its title bar nearest to the other end, across from it.
 */
export function collapsedAreaAnchor(area: Area, toward: GeometryPoint): EdgeAnchor {
  const bar: Bounds = {
    minX: area.x,
    minY: area.y,
    maxX: area.x + area.width,
    maxY: area.y + COLLAPSED_AREA_HEIGHT,
  };
  const side = nearestEdgeSide(bar, toward);
  if (side === "left" || side === "right") {
    return {
      x: side === "right" ? bar.maxX : bar.minX,
      y: clamp(toward.y, bar.minY, bar.maxY),
      side,
    };
  }
  return {
    x: clamp(toward.x, bar.minX, bar.maxX),
    y: side === "top" ? bar.minY : bar.maxY,
    side,
  };
}

/** The anchors of a relationship, start table first. */
export function relationshipAnchors(
  relationship: Relationship,
  startTable: Table,
  endTable: Table,
): { start: EdgeAnchor; end: EdgeAnchor } {
  return {
    start: tableEdgeAnchor(
      startTable,
      relationship.startFieldId,
      boundsCenter(tableBounds(endTable)),
    ),
    end: tableEdgeAnchor(
      endTable,
      relationship.endFieldId,
      boundsCenter(tableBounds(startTable)),
    ),
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

/**
 * The path between two anchors.
 *
 * Without options the path is the legacy horizontal S curve. With the sides
 * of the anchors the control points leave the anchors straight out of the
 * edge they sit on, and when the curve would cross an obstacle the path
 * detours around it as an orthogonal polyline.
 */
export function relationshipPath(
  start: GeometryPoint,
  end: GeometryPoint,
  options?: RelationshipPathOptions,
): string {
  if (!options) {
    const distance = Math.abs(end.x - start.x);
    const control = Math.max(40, distance / 2);
    if (end.x >= start.x) {
      return `M ${start.x} ${start.y} C ${start.x + control} ${start.y}, ${end.x - control} ${end.y}, ${end.x} ${end.y}`;
    }
    // The curve is drawn from right to left: the control points are mirrored.
    return `M ${start.x} ${start.y} C ${start.x - control} ${start.y}, ${end.x + control} ${end.y}, ${end.x} ${end.y}`;
  }

  const startSide = options.startSide ?? (end.x >= start.x ? "right" : "left");
  const endSide =
    options.endSide ??
    (startSide === "right" ? "left" : startSide === "left" ? "right" : startSide === "top" ? "bottom" : "top");
  const startNormal = EDGE_NORMALS[startSide];
  const endNormal = EDGE_NORMALS[endSide];
  const distance =
    startNormal.x !== 0 && endNormal.x !== 0
      ? Math.abs(end.x - start.x)
      : startNormal.x === 0 && endNormal.x === 0
        ? Math.abs(end.y - start.y)
        : Math.hypot(end.x - start.x, end.y - start.y);
  const control = Math.max(40, distance / 2);
  const c1 = {
    x: start.x + startNormal.x * control,
    y: start.y + startNormal.y * control,
  };
  const c2 = {
    x: end.x + endNormal.x * control,
    y: end.y + endNormal.y * control,
  };

  const obstacles = (options.obstacles ?? []).filter(
    (obstacle) => !containsPoint(obstacle, start) && !containsPoint(obstacle, end),
  );
  const hit = obstacles.filter((obstacle) =>
    curveCrosses(start, c1, c2, end, obstacle),
  );
  if (hit.length > 0) {
    return detourPath(start, end, startNormal, endNormal, unionObstacles(hit));
  }
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}
