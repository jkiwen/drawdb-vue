import { graphlib, layout } from "@dagrejs/dagre";
import type {
  EdgeLabel,
  GraphLabel,
  LayoutOptions,
  NodeLabel,
} from "@dagrejs/dagre";

import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";

/** The width of a table that has no width of its own. */
const DEFAULT_TABLE_WIDTH = 220;
/** The height of the header of a table. */
const TABLE_HEADER_HEIGHT = 50;
/** The height of a row of a table. */
const TABLE_FIELD_HEIGHT = 36;

export interface AutoArrangeOptions {
  /** The gap between two tables of the same rank. */
  nodeSep?: number;
  /** The gap between two ranks of tables. */
  rankSep?: number;
  /** The gap between the isolated tables and the other tables. */
  isolatedGap?: number;
  /** The direction of the ranks: top to bottom or left to right. */
  direction?: "TB" | "LR";
}

/** The size of a table on the canvas. */
function sizeOf(table: Table): { width: number; height: number } {
  return {
    width: table.width ?? DEFAULT_TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT * (table.fields?.length ?? 0),
  };
}

/** The coordinates of a table as they are now. */
function originOf(table: Table): { x: number; y: number } {
  return { x: table.x ?? 0, y: table.y ?? 0 };
}

/**
 * Arranges the tables of a diagram.
 *
 * The result has one coordinate per table, in the order of the input. A
 * locked table keeps its coordinates, and a layout that fails leaves every
 * table where it is.
 */
export function autoArrange(
  tables: Table[],
  relationships: Relationship[],
  options: AutoArrangeOptions = {},
): { x: number; y: number }[] {
  const nodeSep = options.nodeSep ?? 60;
  const rankSep = options.rankSep ?? 110;
  const isolatedGap = options.isolatedGap ?? 60;
  const direction = options.direction ?? "TB";

  const tables_ = Array.isArray(tables) ? tables : [];
  const relationships_ = Array.isArray(relationships) ? relationships : [];

  // A single table has nowhere to go.
  if (tables_.length <= 1) {
    return tables_.map(originOf);
  }

  const movable = tables_.filter((table) => !table?.locked);
  const movableIds = new Set(movable.map((table) => String(table.id)));

  const connectedIds = new Set<string>();
  for (const relationship of relationships_) {
    const from = String(relationship?.startTableId);
    const to = String(relationship?.endTableId);
    if (from === to) continue;
    if (!movableIds.has(from) || !movableIds.has(to)) continue;
    connectedIds.add(from);
    connectedIds.add(to);
  }

  const connected = movable.filter((table) => connectedIds.has(String(table.id)));
  const isolated = movable.filter((table) => !connectedIds.has(String(table.id)));

  const positions = new Map<string, { x: number; y: number }>();

  try {
    const graph = new graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>();
    graph.setGraph({
      rankdir: direction,
      nodesep: nodeSep,
      ranksep: rankSep,
      edgesep: 50,
      marginx: 20,
      marginy: 20,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const table of connected) {
      graph.setNode(String(table.id), sizeOf(table));
    }
    for (const relationship of relationships_) {
      const from = String(relationship?.startTableId);
      const to = String(relationship?.endTableId);
      if (from === to) continue;
      if (!connectedIds.has(from) || !connectedIds.has(to)) continue;
      graph.setEdge(from, to);
    }

    layout(graph, {} as LayoutOptions);

    for (const table of connected) {
      const node = graph.node(String(table.id));
      if (!node) continue;
      const size = sizeOf(table);
      positions.set(String(table.id), {
        x: (node.x ?? 0) - size.width / 2,
        y: (node.y ?? 0) - size.height / 2,
      });
    }
  } catch {
    // A layout that fails must not move the diagram.
    return tables_.map(originOf);
  }

  // The isolated tables are laid out in rows below the connected ones.
  let maxX = 0;
  let maxY = 0;
  for (const table of connected) {
    const position = positions.get(String(table.id));
    if (!position) continue;
    const size = sizeOf(table);
    maxX = Math.max(maxX, position.x + size.width);
    maxY = Math.max(maxY, position.y + size.height);
  }

  if (isolated.length > 0) {
    const rowWidth = Math.max(
      maxX,
      4 * DEFAULT_TABLE_WIDTH + 3 * isolatedGap,
    );
    let x = 0;
    let y = connected.length > 0 ? maxY + rankSep : 0;
    let rowHeight = 0;
    for (const table of isolated) {
      const size = sizeOf(table);
      if (x > 0 && x + size.width > rowWidth) {
        x = 0;
        y += rowHeight + isolatedGap;
        rowHeight = 0;
      }
      positions.set(String(table.id), { x, y });
      x += size.width + isolatedGap;
      rowHeight = Math.max(rowHeight, size.height);
    }
  }

  return tables_.map((table) => positions.get(String(table.id)) ?? originOf(table));
}
