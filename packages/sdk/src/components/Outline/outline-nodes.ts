import type {
  Diagram,
  LogicalRelationship,
  Relationship,
  Table,
} from "@drawdb/core";
import { t } from "../../i18n/index.ts";

/**
 * The node vocabulary and the per-element node builders of the outline
 * tree (plan Task 2). `outline-model.ts` assembles these builders into the
 * tree; everything here stays pure so the per-layer naming and the filter
 * rules are testable without a DOM.
 *
 * Rulings baked in here:
 * - Q15: the views, the enums and the types exist on the physical layer
 *   only, so their categories hide in the logical view.
 * - The labels follow the view layer: the logical view reads
 *   `table.logical.name` and the attribute names, the physical view reads
 *   `Table.name` and `PhysicalField.name`; the name of the other layer is
 *   kept on `altLabel` for the tooltip.
 * - The filter matches both layer names; a hit field brings its parent
 *   table along.
 */

export type OutlineViewLayer = "logical" | "physical";
export type OutlineSortMode = "name" | "created";

export type OutlineCategoryKey =
  | "tables"
  | "relationships"
  | "areas"
  | "notes"
  | "views"
  | "enums"
  | "types";

export type OutlineNodeKind =
  | "category"
  | "table"
  | "field"
  | "relationship"
  | "area"
  | "area-table"
  | "note"
  | "view"
  | "enum"
  | "type";

export interface OutlineNode {
  /** The stable key, e.g. `cat:tables`, `table:<id>`, `field:<tableId>:<fieldId>`. */
  id: string;
  kind: OutlineNodeKind;
  /** The name of the current view layer. */
  label: string;
  /** The name of the other layer, shown as the tooltip. */
  altLabel?: string;
  /** The category a leaf belongs to. */
  category?: OutlineCategoryKey;
  /** The id of the underlying element (table, field, relationship, ...). */
  refId?: string | number;
  /** The table of a field, the area of an area-table. */
  parentRefId?: string | number;
  /** The badge of a category: the number of its direct children. */
  count?: number;
  /** Whether the node itself matched the active filter. */
  matched: boolean;
  children: OutlineNode[];
}

export interface OutlineRow {
  node: OutlineNode;
  depth: number;
  hasChildren: boolean;
}

export const CATEGORY_LABEL_KEYS: Record<OutlineCategoryKey, string> = {
  tables: "outline_category_tables",
  relationships: "outline_category_relationships",
  areas: "outline_category_areas",
  notes: "outline_category_notes",
  views: "outline_category_views",
  enums: "outline_category_enums",
  types: "outline_category_types",
};

/** The categories of one layer, in their fixed order (Q15). */
export function categoriesOf(viewLayer: OutlineViewLayer): OutlineCategoryKey[] {
  const base: OutlineCategoryKey[] = ["tables", "relationships", "areas", "notes"];
  return viewLayer === "physical" ? [...base, "views", "enums", "types"] : base;
}

function matches(label: string | undefined, query: string): boolean {
  return label !== undefined && label.toLowerCase().includes(query);
}

/** A node matches an empty query or either of its two layer names. */
export function matchesNode(
  label: string,
  altLabel: string | undefined,
  query: string,
): boolean {
  return query === "" || matches(label, query) || matches(altLabel, query);
}

/** Sorts the children of one level in place when the mode asks for it. */
export function sortChildren(nodes: OutlineNode[], sort: OutlineSortMode): void {
  if (sort !== "name") return;
  nodes.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export function tableLabel(table: Table, viewLayer: OutlineViewLayer): string {
  return viewLayer === "logical" ? table.logical.name : table.name;
}

export function tableAltLabel(table: Table, viewLayer: OutlineViewLayer): string {
  return viewLayer === "logical" ? table.name : table.logical.name;
}

function fieldLabels(
  table: Table,
  fieldId: string,
  viewLayer: OutlineViewLayer,
): { label: string; altLabel?: string } {
  const field = table.fields.find((item) => item.id === fieldId);
  const attribute = table.logical.attributes.find(
    (item) => item.fieldId === fieldId,
  );
  const physical = field?.name ?? String(fieldId);
  const logical = attribute?.name ?? physical;
  return viewLayer === "logical"
    ? { label: logical, altLabel: physical }
    : { label: physical, altLabel: attribute ? logical : undefined };
}

/**
 * The table node with its field children; `undefined` when an active
 * filter matches neither the table nor any of its fields.
 */
export function buildTableNode(
  table: Table,
  viewLayer: OutlineViewLayer,
  query: string,
): OutlineNode | undefined {
  const label = tableLabel(table, viewLayer);
  const altLabel = tableAltLabel(table, viewLayer);
  const tableHit = matchesNode(label, altLabel, query);
  const fields: OutlineNode[] = [];
  for (const field of table.fields) {
    const labels = fieldLabels(table, String(field.id), viewLayer);
    const fieldHit = matchesNode(labels.label, labels.altLabel, query);
    if (query !== "" && !tableHit && !fieldHit) continue;
    fields.push({
      id: `field:${table.id}:${field.id}`,
      kind: "field",
      label: labels.label,
      altLabel: labels.altLabel,
      category: "tables",
      refId: field.id,
      parentRefId: table.id,
      matched: fieldHit,
      children: [],
    });
  }
  if (query !== "" && !tableHit && fields.length === 0) return undefined;
  return {
    id: `table:${table.id}`,
    kind: "table",
    label,
    altLabel,
    category: "tables",
    refId: table.id,
    matched: tableHit,
    children: fields,
  };
}

/**
 * The two layer names of a relationship. The relationship's own name leads
 * on both layers — a relationship is a constraint with one name, and the
 * tree should name it whatever the view layer is — with the other layer's
 * name on the secondary label. A relationship with no name at all falls back
 * to the pair of its table names on the layer in question.
 */
export function relationshipLabels(
  relationship: Relationship,
  logical: LogicalRelationship | undefined,
  diagram: Diagram,
  viewLayer: OutlineViewLayer,
): { label: string; altLabel?: string } {
  const tableName = (id: string | number, layer: OutlineViewLayer) => {
    const table = diagram.tables.find((item) => item.id === id);
    return table ? tableLabel(table, layer) : String(id);
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

/** The first-level category node with its count badge. */
export function buildCategory(
  key: OutlineCategoryKey,
  children: OutlineNode[],
): OutlineNode {
  return {
    id: `cat:${key}`,
    kind: "category",
    label: t(CATEGORY_LABEL_KEYS[key]),
    category: key,
    count: children.length,
    matched: false,
    children,
  };
}

/** A childless node of one of the simple collections. */
export function leaf(
  kind: OutlineNodeKind,
  category: OutlineCategoryKey,
  refId: string | number,
  label: string,
  query: string,
): OutlineNode | undefined {
  if (!matchesNode(label, undefined, query)) return undefined;
  return {
    id: `${kind}:${refId}`,
    kind,
    label,
    category,
    refId,
    matched: query !== "",
    children: [],
  };
}
