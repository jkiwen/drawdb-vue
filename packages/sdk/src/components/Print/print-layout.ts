import type { Table } from "@drawdb/core";

/**
 * The pagination of the print preview (ruling Q8): the preview is a sheet of
 * pages, not a zoomed canvas. Tables flow in reading order, wrap at the width
 * of the page and start a new page when the current one is full.
 *
 * The geometry is in CSS pixels of a 96 dpi sheet, because that is the unit
 * the browser uses when it prints a page of A4 from the screen.
 */
export interface PrintPageSize {
  width: number;
  height: number;
}

/** The size of an A4 sheet at 96 dpi, which is what `window.print` lays out. */
export const A4: PrintPageSize = { width: 794, height: 1123 };

/** The margin of the sheet, in the same pixels. */
export const PRINT_MARGIN = 36;

/** The gap between two tables of the sheet. */
export const PRINT_GAP = 16;

/** A table as the preview draws it. */
export interface PrintBox {
  table: Table;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The text lines of the box: the name and the fields the sheet shows. */
  lines: string[];
}

/** One page of the preview. */
export interface PrintPage {
  index: number;
  boxes: PrintBox[];
}

export interface PrintLayoutOptions {
  page?: PrintPageSize;
  margin?: number;
  gap?: number;
  /** The height of one line of a box, in the same pixels. */
  lineHeight?: number;
  /** How many fields a box prints before it stops, per table. */
  maxFields?: number;
}

const DEFAULT_LINE_HEIGHT = 14;
const DEFAULT_MAX_FIELDS = 12;
const BOX_PADDING = 8;
const BOX_HEADER_HEIGHT = 18;
const MIN_BOX_WIDTH = 150;
const MAX_BOX_WIDTH = 260;

/** How wide a table wants to be: wide names get a wider box, within limits. */
export function boxWidth(table: Table, lines: readonly string[]): number {
  const longest = [table.name, ...lines].reduce((widest, line) => Math.max(widest, line.length), 0);
  return Math.max(MIN_BOX_WIDTH, Math.min(MAX_BOX_WIDTH, longest * 7 + 24));
}

/** The field lines a table prints: names and their physical types. */
export function printFieldLines(table: Table, maxFields = DEFAULT_MAX_FIELDS): string[] {
  return table.fields.slice(0, maxFields).map((field) => {
    const type = field.fieldType.type;
    const length = field.fieldType.length;
    return length === undefined ? `${field.name}  ${type}` : `${field.name}  ${type}(${length})`;
  });
}

/**
 * Lays the tables out over as many pages as they need.
 *
 * Every table is measured from its own text, so a box that would not fit in
 * the remaining height of the page starts the next one. A table taller than a
 * page is cut into the fields that fit, which is what a printed sheet can do
 * without a second column.
 */
export function printPages(tables: readonly Table[], options: PrintLayoutOptions = {}): PrintPage[] {
  const page = options.page ?? A4;
  const margin = options.margin ?? PRINT_MARGIN;
  const gap = options.gap ?? PRINT_GAP;
  const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const maxFields = options.maxFields ?? DEFAULT_MAX_FIELDS;
  const innerWidth = page.width - margin * 2;
  const innerHeight = page.height - margin * 2;

  const pages: PrintPage[] = [];
  let boxes: PrintBox[] = [];
  let cursorX = margin;
  let cursorY = margin;
  let rowHeight = 0;

  const flush = (): void => {
    if (boxes.length > 0) {
      pages.push({ index: pages.length, boxes });
      boxes = [];
    }
    cursorX = margin;
    cursorY = margin;
    rowHeight = 0;
  };

  for (const table of tables) {
    const lines = printFieldLines(table, maxFields);
    const width = boxWidth(table, lines);
    const height = BOX_PADDING * 2 + BOX_HEADER_HEIGHT + lines.length * lineHeight;

    if (cursorX + width > margin + innerWidth && cursorX > margin) {
      cursorX = margin;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }
    if (cursorY + height > margin + innerHeight && cursorY > margin) {
      flush();
    }

    boxes.push({ table, x: cursorX, y: cursorY, width, height, lines });
    cursorX += width + gap;
    rowHeight = Math.max(rowHeight, height);
  }
  flush();

  return pages;
}

/** How many pages the sheet needs, which the preview shows next to the arrows. */
export function pageCount(tables: readonly Table[], options: PrintLayoutOptions = {}): number {
  return printPages(tables, options).length;
}
