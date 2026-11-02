import type { Diagram, LogicalRelationship, Relationship } from "@drawdb/core";
import type { OutlineViewLayer } from "./outline-nodes.ts";

/**
 * The two layer names of a relationship.
 *
 * The tree names an object after the layer it shows (design 3.1: the logical
 * view shows the logical name of every object, the physical view the physical
 * one), so the logical view leads with the name of the logical relationship
 * and the physical view with the name of the physical one; the name of the
 * other layer is the secondary label (the tooltip). A relationship with no
 * name at all falls back to the pair of its table names on the layer in
 * question.
 *
 * It lives in its own module so that `outline-nodes.ts` and
 * `outline-constraints.ts` can both name relationships without importing each
 * other.
 */
export function relationshipLabels(
  relationship: Relationship,
  logical: LogicalRelationship | undefined,
  diagram: Diagram,
  viewLayer: OutlineViewLayer,
): { label: string; altLabel?: string } {
  const tableName = (id: string | number, layer: OutlineViewLayer) => {
    const table = diagram.tables.find((item) => item.id === id);
    return table
      ? layer === "logical"
        ? table.logical.name
        : table.name
      : String(id);
  };
  const fallback = (layer: OutlineViewLayer) =>
    `${tableName(relationship.startTableId, layer)} → ${tableName(relationship.endTableId, layer)}`;
  const physical = relationship.name?.trim() ?? "";
  const logicalName = logical?.name?.trim() ?? "";
  // The name of the layer the tree shows leads; the name of the other one is
  // the secondary label. A layer that carries no name of its own borrows the
  // name of the other one, so a relationship that was never named twice is
  // still named.
  const own = viewLayer === "logical" ? logicalName : physical;
  const other = viewLayer === "logical" ? physical : logicalName;
  const label = own || other || fallback(viewLayer);
  return {
    label,
    altLabel: other !== "" && other !== label ? other : undefined,
  };
}
