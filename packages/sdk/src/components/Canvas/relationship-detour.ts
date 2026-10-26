import type { Bounds, GeometryPoint } from "./geometry.ts";

/**
 * The orthogonal detour of a relationship path around an obstacle.
 *
 * Two anchors that face each other sideways detour above or below the
 * obstacle, whichever is shorter; two anchors that face up and down detour
 * left or right. A mixed pair turns once, at the corner that crosses less.
 */

/** The gap a detour keeps around an obstacle. */
const OBSTACLE_MARGIN = 16;

/** The length of the stub that leaves an anchor before a detour turns. */
const DETOUR_STUB = 28;

/** Whether a point lies strictly inside of a box. */
export function containsPoint(bounds: Bounds, point: GeometryPoint): boolean {
  return (
    point.x > bounds.minX &&
    point.x < bounds.maxX &&
    point.y > bounds.minY &&
    point.y < bounds.maxY
  );
}

/** Whether the ranges (a1, a2) and (b1, b2) share more than a border. */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.min(a1, a2) < b2 && Math.max(a1, a2) > b1;
}

/** Whether a straight segment crosses the inside of a box. */
function segmentCrosses(a: GeometryPoint, b: GeometryPoint, bounds: Bounds): boolean {
  if (a.x === b.x) {
    return (
      a.x > bounds.minX &&
      a.x < bounds.maxX &&
      rangesOverlap(a.y, b.y, bounds.minY, bounds.maxY)
    );
  }
  if (a.y === b.y) {
    return (
      a.y > bounds.minY &&
      a.y < bounds.maxY &&
      rangesOverlap(a.x, b.x, bounds.minX, bounds.maxX)
    );
  }
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    if (
      containsPoint(bounds, {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      })
    ) {
      return true;
    }
  }
  return false;
}

/** Samples of a cubic bezier, without the endpoints. */
function bezierSamples(
  p0: GeometryPoint,
  c1: GeometryPoint,
  c2: GeometryPoint,
  p1: GeometryPoint,
): GeometryPoint[] {
  const points: GeometryPoint[] = [];
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const mt = 1 - t;
    points.push({
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * p1.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * p1.y,
    });
  }
  return points;
}

/** Whether the bezier between two anchors crosses the inside of a box. */
export function curveCrosses(
  start: GeometryPoint,
  c1: GeometryPoint,
  c2: GeometryPoint,
  end: GeometryPoint,
  obstacle: Bounds,
): boolean {
  return bezierSamples(start, c1, c2, end).some((point) =>
    containsPoint(obstacle, point),
  );
}

/** The box that covers a list of boxes, plus the detour margin. */
export function unionObstacles(list: Bounds[]): Bounds {
  const union = list.reduce((acc, bounds) => ({
    minX: Math.min(acc.minX, bounds.minX),
    minY: Math.min(acc.minY, bounds.minY),
    maxX: Math.max(acc.maxX, bounds.maxX),
    maxY: Math.max(acc.maxY, bounds.maxY),
  }));
  return {
    minX: union.minX - OBSTACLE_MARGIN,
    minY: union.minY - OBSTACLE_MARGIN,
    maxX: union.maxX + OBSTACLE_MARGIN,
    maxY: union.maxY + OBSTACLE_MARGIN,
  };
}

/**
 * The x of the vertical leg of a detour.
 *
 * The stub that leaves the anchor is pulled back to the border of the
 * obstacle when it would cross it, so that the vertical leg stays outside.
 */
function stubX(point: GeometryPoint, normal: GeometryPoint, obstacle: Bounds): number {
  let x = point.x + normal.x * DETOUR_STUB;
  const legCrosses =
    point.y > obstacle.minY &&
    point.y < obstacle.maxY &&
    rangesOverlap(point.x, x, obstacle.minX, obstacle.maxX);
  if (legCrosses) {
    x = normal.x > 0 ? obstacle.minX : obstacle.maxX;
  }
  return x;
}

/** The y of the horizontal leg of a detour; the vertical counterpart of stubX. */
function stubY(point: GeometryPoint, normal: GeometryPoint, obstacle: Bounds): number {
  let y = point.y + normal.y * DETOUR_STUB;
  const legCrosses =
    point.x > obstacle.minX &&
    point.x < obstacle.maxX &&
    rangesOverlap(point.y, y, obstacle.minY, obstacle.maxY);
  if (legCrosses) {
    y = normal.y > 0 ? obstacle.minY : obstacle.maxY;
  }
  return y;
}

/** The number of segments of a polyline that cross a box. */
function crossings(points: GeometryPoint[], obstacle: Bounds): number {
  let count = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    if (segmentCrosses(points[i], points[i + 1], obstacle)) {
      count++;
    }
  }
  return count;
}

/** An orthogonal detour around an obstacle. */
export function detourPath(
  start: GeometryPoint,
  end: GeometryPoint,
  startNormal: GeometryPoint,
  endNormal: GeometryPoint,
  obstacle: Bounds,
): string {
  if (startNormal.x !== 0 && endNormal.x !== 0) {
    const corridorTop = obstacle.minY;
    const corridorBottom = obstacle.maxY;
    const costTop = Math.abs(start.y - corridorTop) + Math.abs(end.y - corridorTop);
    const costBottom =
      Math.abs(start.y - corridorBottom) + Math.abs(end.y - corridorBottom);
    const corridorY = costTop <= costBottom ? corridorTop : corridorBottom;
    const x1 = stubX(start, startNormal, obstacle);
    const x2 = stubX(end, endNormal, obstacle);
    return [
      `M ${start.x} ${start.y}`,
      `L ${x1} ${start.y}`,
      `L ${x1} ${corridorY}`,
      `L ${x2} ${corridorY}`,
      `L ${x2} ${end.y}`,
      `L ${end.x} ${end.y}`,
    ].join(" ");
  }
  if (startNormal.y !== 0 && endNormal.y !== 0) {
    const corridorLeft = obstacle.minX;
    const corridorRight = obstacle.maxX;
    const costLeft = Math.abs(start.x - corridorLeft) + Math.abs(end.x - corridorLeft);
    const costRight =
      Math.abs(start.x - corridorRight) + Math.abs(end.x - corridorRight);
    const corridorX = costLeft <= costRight ? corridorLeft : corridorRight;
    const y1 = stubY(start, startNormal, obstacle);
    const y2 = stubY(end, endNormal, obstacle);
    return [
      `M ${start.x} ${start.y}`,
      `L ${start.x} ${y1}`,
      `L ${corridorX} ${y1}`,
      `L ${corridorX} ${y2}`,
      `L ${end.x} ${y2}`,
      `L ${end.x} ${end.y}`,
    ].join(" ");
  }
  const p1 = {
    x: start.x + startNormal.x * DETOUR_STUB,
    y: start.y + startNormal.y * DETOUR_STUB,
  };
  const p2 = {
    x: end.x + endNormal.x * DETOUR_STUB,
    y: end.y + endNormal.y * DETOUR_STUB,
  };
  const viaA = [start, p1, { x: p2.x, y: p1.y }, p2, end];
  const viaB = [start, p1, { x: p1.x, y: p2.y }, p2, end];
  const chosen = crossings(viaA, obstacle) <= crossings(viaB, obstacle) ? viaA : viaB;
  return chosen.map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}
