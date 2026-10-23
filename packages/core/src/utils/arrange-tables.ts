import type { Table } from "../models/table.ts";

/** Height of a table header row in the canvas, in pixels. */
export const TABLE_HEADER_HEIGHT = 50;
/** Height of a single field row in the canvas, in pixels. */
export const TABLE_FIELD_HEIGHT = 36;
/** Height of the coloured strip above a table header, in pixels. */
export const TABLE_COLOR_STRIP_HEIGHT = 7;

const TABLE_WIDTH = 200;
const GAP_X = 54;
const GAP_Y = 40;

/**
 * Lay imported tables out in a readable grid.
 *
 * The first half of the tables is placed in the top row, the remainder in a
 * second row underneath, so that a freshly imported diagram never has
 * overlapping tables.
 */
export function arrangeTables(tables: Table[]): void {
  let maxHeight = -1;

  tables.forEach((table, index) => {
    if (index < tables.length / 2) {
      table.x = index * TABLE_WIDTH + (index + 1) * GAP_X;
      table.y = GAP_Y;
      const height =
        table.fields.length * TABLE_FIELD_HEIGHT +
        TABLE_HEADER_HEIGHT +
        TABLE_COLOR_STRIP_HEIGHT;
      maxHeight = Math.max(height, maxHeight);
    } else {
      const column = tables.length - index - 1;
      table.x = column * TABLE_WIDTH + (column + 1) * GAP_X;
      table.y = maxHeight + 2 * GAP_Y;
    }
  });
}
