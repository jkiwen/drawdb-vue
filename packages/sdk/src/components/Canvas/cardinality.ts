import type { CardinalitySide, GeometryPoint } from "./geometry.ts";

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

/**
 * The text of a cardinality side.
 *
 * The reference application draws the cardinality as a label ("1" or "n") on a
 * rounded background, and not as a tick or a crow's foot: the label says
 * exactly what the relation means.
 */
export function cardinalityText(side: CardinalitySide): string {
  return side === "many" ? "n" : "1";
}
