import type { Area, Diagram } from "@drawdb/core";
import { areaHolds, elementBounds } from "../../utils/elements.ts";
import {
  buildCategory,
  buildTableNode,
  categoriesOf,
  leaf,
  matchesNode,
  relationshipLabels,
  sortChildren,
  tableAltLabel,
  tableLabel,
} from "./outline-nodes.ts";

/**
 * The pure derivation of the outline tree (plan Task 2): the assembly of
 * the hierarchy plus the read helpers the component needs (flatten, path,
 * branch ids, virtual-scroll window). The node vocabulary and the
 * per-element builders live in `outline-nodes.ts`; the component only
 * renders what these functions return.
 */
import type {
  OutlineCategoryKey,
  OutlineNode,
  OutlineRow,
  OutlineSortMode,
  OutlineViewLayer,
} from "./outline-nodes.ts";

export type {
  OutlineCategoryKey,
  OutlineNode,
  OutlineNodeKind,
  OutlineRow,
  OutlineSortMode,
  OutlineViewLayer,
} from "./outline-nodes.ts";

/**
 * Builds the tree of the outline for one diagram, view layer, filter text
 * and sort mode.
 *
 * The filter is a case-insensitive fuzzy match (substring) against the
 * names of both layers; with an active filter the categories without a
 * match drop out and only the matching fields stay under their table.
 */
export function buildOutlineTree(
  diagram: Diagram,
  viewLayer: OutlineViewLayer,
  filter = "",
  sort: OutlineSortMode = "created",
): OutlineNode[] {
  const query = filter.trim().toLowerCase();
  const areas = diagram.areas ?? diagram.subjectAreas;
  const logicalById = new Map(
    (diagram.logicalRelationships ?? []).map((item) => [item.id, item]),
  );

  const tables = diagram.tables
    .map((table) => buildTableNode(table, viewLayer, query))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);

  const relationships = diagram.relationships
    .map((relationship) => {
      const labels = relationshipLabels(
        relationship,
        logicalById.get(relationship.id),
        diagram,
        viewLayer,
      );
      if (!matchesNode(labels.label, labels.altLabel, query)) return undefined;
      return {
        id: `relationship:${relationship.id}`,
        kind: "relationship",
        label: labels.label,
        altLabel: labels.altLabel,
        category: "relationships",
        refId: relationship.id,
        matched: query !== "",
        children: [],
      } satisfies OutlineNode;
    })
    .filter((node): node is NonNullable<typeof node> => node !== undefined);

  const areaNodes = areas
    .map((area: Area) => {
      const areaHit = matchesNode(area.name, undefined, query);
      const held = diagram.tables
        .filter((table) => areaHolds(area, elementBounds(table)))
        .map((table) => {
          const label = tableLabel(table, viewLayer);
          const altLabel = tableAltLabel(table, viewLayer);
          const tableHit = matchesNode(label, altLabel, query);
          if (query !== "" && !areaHit && !tableHit) return undefined;
          return {
            id: `area-table:${area.id}:${table.id}`,
            kind: "area-table",
            label,
            altLabel,
            category: "areas",
            refId: table.id,
            parentRefId: area.id,
            matched: tableHit,
            children: [],
          } satisfies OutlineNode;
        })
        .filter((node): node is NonNullable<typeof node> => node !== undefined);
      if (query !== "" && !areaHit && held.length === 0) return undefined;
      return {
        id: `area:${area.id}`,
        kind: "area",
        label: area.name,
        category: "areas",
        refId: area.id,
        matched: areaHit,
        children: held,
      } satisfies OutlineNode;
    })
    .filter((node): node is NonNullable<typeof node> => node !== undefined);

  const notes = diagram.notes
    .map((note) => leaf("note", "notes", note.id, note.title, query))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  const views = diagram.views
    .map((view) => leaf("view", "views", view.id, view.name, query))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  const enums = diagram.enums
    .map((item) => leaf("enum", "enums", item.id ?? item.name, item.name, query))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  const types = diagram.types
    .map((item) => leaf("type", "types", item.id ?? item.name, item.name, query))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);

  const childrenByCategory: Record<OutlineCategoryKey, OutlineNode[]> = {
    tables,
    relationships,
    areas: areaNodes,
    notes,
    views,
    enums,
    types,
  };

  const tree: OutlineNode[] = [];
  for (const key of categoriesOf(viewLayer)) {
    const children = childrenByCategory[key];
    for (const child of children) sortChildren(child.children, sort);
    sortChildren(children, sort);
    // With an active filter the empty categories drop out; without one they
    // stay visible with a zero count so the structure is discoverable.
    if (query !== "" && children.length === 0) continue;
    tree.push(buildCategory(key, children));
  }
  return tree;
}

/**
 * Flattens the visible rows of the tree: a node lists its children only
 * when its id is in `expanded`. The component renders this flat list with
 * the virtual scroll.
 */
export function flattenOutlineTree(
  nodes: readonly OutlineNode[],
  expanded: ReadonlySet<string>,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const walk = (items: readonly OutlineNode[], depth: number): void => {
    for (const node of items) {
      const hasChildren = node.children.length > 0;
      rows.push({ node, depth, hasChildren });
      if (hasChildren && expanded.has(node.id)) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return rows;
}

/**
 * The ancestor chain of a node, root first, or `undefined` when the id is
 * not in the tree. The reveal of the canvas selection expands every
 * ancestor of the chain.
 */
export function outlineNodePath(
  nodes: readonly OutlineNode[],
  id: string,
): OutlineNode[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const rest = outlineNodePath(node.children, id);
    if (rest !== undefined) return [node, ...rest];
  }
  return undefined;
}

/**
 * The ids of every branch node (a node with children), optionally narrowed
 * by `include`. The component uses the full set to auto-expand under an
 * active filter and the set without the tables as the expansion default.
 */
export function outlineBranchIds(
  nodes: readonly OutlineNode[],
  include: (node: OutlineNode) => boolean = () => true,
): Set<string> {
  const ids = new Set<string>();
  const walk = (items: readonly OutlineNode[]): void => {
    for (const node of items) {
      if (node.children.length > 0 && include(node)) ids.add(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

/** One windowed row of the virtual scroll: the row and its flat index. */
export interface OutlineWindowRow {
  row: OutlineRow;
  index: number;
}

/**
 * The visible window of the flattened rows for the virtual scroll: the
 * slice around `scrollTop` with `overscan` rows of margin on both sides.
 */
export function windowOutlineRows(
  rows: readonly OutlineRow[],
  scrollTop: number,
  viewportHeight: number,
  rowHeight = 26,
  overscan = 10,
): OutlineWindowRow[] {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const count = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  return rows
    .slice(start, start + count)
    .map((row, offset) => ({ row, index: start + offset }));
}
