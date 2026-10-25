import type { Table } from "@drawdb/core";

/**
 * The geometry of the details of a table.
 *
 * The details sit inside the body of the table, between the header and the
 * fields, so the table grows to fit them. Every row of the details has a
 * fixed height: the colour row and the two action rows are 28px, the two
 * section titles are 24px, and every index or unique constraint takes one
 * 28px row. The padding above and below the details is 8px. The numbers
 * match the styles of the details in canvas.css.
 */
export const TABLE_DETAILS_PADDING_Y = 8;
export const TABLE_DETAILS_ROW_HEIGHT = 28;
export const TABLE_DETAILS_SECTION_HEIGHT = 24;

/** The height the details of a table add to it: zero while they are hidden. */
export function tableDetailsHeight(table: Table): number {
  if (table.details !== true) {
    return 0;
  }
  const rows = (table.indices?.length ?? 0) + (table.uniqueConstraints?.length ?? 0);
  return (
    TABLE_DETAILS_PADDING_Y * 2 +
    TABLE_DETAILS_ROW_HEIGHT +
    TABLE_DETAILS_SECTION_HEIGHT * 2 +
    rows * TABLE_DETAILS_ROW_HEIGHT +
    TABLE_DETAILS_ROW_HEIGHT * 2
  );
}
