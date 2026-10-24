import type { Table } from "@drawdb/core";
import { DEFAULT_TABLE_WIDTH } from "./geometry.ts";

/*
 * The comment of a table is drawn under its name and makes the header
 * taller. The reference application measures the height of the comment with
 * these numbers: a line is 16px high, the comment is at most 5 lines long
 * and it has a padding of 12px at the bottom.
 */
export const TABLE_COMMENT_LINE_HEIGHT = 16;
export const TABLE_COMMENT_MAX_LINES = 5;
export const TABLE_COMMENT_PADDING_BOTTOM = 12;
export const TABLE_COMMENT_INSET = 28;

/** The width of a table, the default one when it has none. */
export function commentTableWidth(table: Table): number {
  return table.width && table.width > 0 ? table.width : DEFAULT_TABLE_WIDTH;
}

/**
 * The number of lines the comment of a table takes.
 *
 * The comment is wrapped at the width of the table, so the number of lines
 * depends on the width of the table.
 */
export function tableCommentLines(table: Table): number {
  const comment = table.comment;
  if (!comment) return 0;

  const width = Math.max(1, commentTableWidth(table) - TABLE_COMMENT_INSET);
  // A character takes about 6px in the font of the comment.
  const perLine = Math.max(1, Math.floor(width / 6));
  const lines = comment
    .split("\n")
    .reduce((total, paragraph) => {
      const wrapped = Math.max(1, Math.ceil(paragraph.length / perLine));
      return total + wrapped;
    }, 0);

  return Math.min(lines, TABLE_COMMENT_MAX_LINES);
}

/**
 * The height the comment of a table adds to its header.
 */
export function tableCommentHeight(table: Table): number {
  const lines = tableCommentLines(table);
  if (lines === 0) return 0;

  return lines * TABLE_COMMENT_LINE_HEIGHT + TABLE_COMMENT_PADDING_BOTTOM;
}
