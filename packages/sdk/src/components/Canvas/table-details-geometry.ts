import type { Table } from "@drawdb/core";

/**
 * The geometry of the details of a table.
 *
 * The details sit inside the body of the table, between the header and the
 * fields, so the table grows to fit them. Every row of the details has a
 * fixed height: the colour row is 28px and the padding above and below is
 * 8px. The indices and the unique constraints left this block for the panel
 * (review of 2026-10-29). The numbers match canvas.css.
 */
export const TABLE_DETAILS_PADDING_Y = 8;
export const TABLE_DETAILS_ROW_HEIGHT = 28;
export const TABLE_DETAILS_SECTION_HEIGHT = 24;

/** The height the details of a table add to it: zero while they are hidden. */
export function tableDetailsHeight(table: Table): number {
  if (table.details !== true) {
    return 0;
  }
  return TABLE_DETAILS_PADDING_Y * 2 + TABLE_DETAILS_ROW_HEIGHT;
}
