import type { Diagram, LogicalRelationship, Relationship } from "@drawdb/core";
import type { OutlineViewLayer } from "./outline-nodes.ts";

/**
 * The two layer names of a relationship. The relationship's own name leads
 * on both layers — a relationship is a constraint with one name, and the tree
 * should name it whatever the view layer is — with the other layer's name on
 * the secondary label. A relationship with no name at all falls back to the
 * pair of its table names on the layer in question.
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
  const label = physical || logicalName || fallback(viewLayer);
  return {
    label,
    altLabel: logicalName !== "" && logicalName !== label ? logicalName : undefined,
  };
}
