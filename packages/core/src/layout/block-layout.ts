import type { Table } from "../models/table.ts";
import { TABLE_FIELD_HEIGHT, TABLE_HEADER_HEIGHT } from "../utils/arrange-tables.ts";

/**
 * The block layouts of the toolbar (design 6.3): the Grid packs the tables
 * into columns of equal cell width, the Flow packs them left to right and
 * wraps at a width. Both only compute coordinates; the caller owns the
 * command that moves the tables, so a layout is one undo step.
 *
 * The locked tables are filtered out by the caller: a layout never moves a
 * table the user pinned (Q6).
 */

/** The width a table gets when it carries none of its own. */
const DEFAULT_TABLE_WIDTH = 220;

export interface BlockLayoutOptions {
  /** The number of columns; the square root of the count by default. */
  columns?: number;
  /** The width a row may reach before it wraps (Flow only). */
  maxWidth?: number;
  /** The space between two tables and between two rows. */
  gap?: number;
  /** The width of a table that carries none of its own. */
  tableWidth?: number;
}

function sizeOf(table: Table, fallbackWidth: number): { width: number; height: number } {
  return {
    width: table.width ?? fallbackWidth,
    height: TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT * (table.fields?.length ?? 0),
  };
}

/** The widest table per column, which fixes the width of a grid column. */
function columnWidths(
  tables: readonly Table[],
  columns: number,
  fallbackWidth: number,
): number[] {
  const widths = new Array<number>(columns).fill(0);
  tables.forEach((table, index) => {
    const column = index % columns;
    widths[column] = Math.max(widths[column], sizeOf(table, fallbackWidth).width);
  });
  return widths;
}

/** The tallest table per row, which fixes the height of a grid row. */
function rowHeights(
  tables: readonly Table[],
  columns: number,
  fallbackWidth: number,
): number[] {
  const heights: number[] = [];
  tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    heights[row] = Math.max(heights[row] ?? 0, sizeOf(table, fallbackWidth).height);
  });
  return heights;
}

/**
 * Lays the tables out in a grid of `columns` columns. Every column is as
 * wide as its widest table and every row as tall as its tallest one, so the
 * cells stay aligned whatever the field counts are.
 */
export function gridLayout(
  tables: readonly Table[],
  options: BlockLayoutOptions = {},
): { x: number; y: number }[] {
  if (tables.length === 0) return [];

  const gap = options.gap ?? 60;
  const fallbackWidth = options.tableWidth ?? DEFAULT_TABLE_WIDTH;
  const columns = Math.max(1, options.columns ?? Math.ceil(Math.sqrt(tables.length)));

  const widths = columnWidths(tables, columns, fallbackWidth);
  const heights = rowHeights(tables, columns, fallbackWidth);
  const offsets: number[] = [];
  widths.reduce((total, width, index) => {
    offsets[index] = total;
    return total + width + gap;
  }, 0);
  const rowOffsets: number[] = [];
  heights.reduce((total, height, index) => {
    rowOffsets[index] = total;
    return total + height + gap;
  }, 0);

  return tables.map((_, index) => ({
    x: offsets[index % columns] ?? 0,
    y: rowOffsets[Math.floor(index / columns)] ?? 0,
  }));
}

/**
 * Packs the tables left to right, wrapping when the next table would pass
 * `maxWidth`. A row is as tall as its tallest table, so the tables of a
 * short row do not overlap the next one.
 */
export function flowLayout(
  tables: readonly Table[],
  options: BlockLayoutOptions = {},
): { x: number; y: number }[] {
  if (tables.length === 0) return [];

  const gap = options.gap ?? 60;
  const fallbackWidth = options.tableWidth ?? DEFAULT_TABLE_WIDTH;
  const maxWidth = options.maxWidth ?? 1200;

  const positions: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const table of tables) {
    const size = sizeOf(table, fallbackWidth);
    if (x > 0 && x + size.width > maxWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    positions.push({ x, y });
    x += size.width + gap;
    rowHeight = Math.max(rowHeight, size.height);
  }

  return positions;
}
