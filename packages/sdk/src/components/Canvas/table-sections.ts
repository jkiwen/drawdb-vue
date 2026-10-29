import type { Table, ViewLayer, ViewStateToggles } from "@drawdb/core";
import {
  foreignSection,
  indexSection,
  primarySection,
  uniqueSection,
} from "./table-key-sections.ts";
import { TABLE_COMMENT_INSET } from "./table-comment.ts";

/**
 * The display blocks of a table node (section 7 of the UI document).
 *
 * The keys, the indices and the description of a table are drawn below the
 * field list, one block each, in the order PK, FK, UK, INDEX and the
 * description. Every block but the description carries a short label, and
 * the table grows to fit the blocks, so the canvas measures them here and
 * the node draws exactly what is measured.
 *
 * The blocks are derived from the same toggles as the field list: `pkUkFk`
 * shows the three key blocks, `indexes` shows the index block and
 * `description` shows the description block. The key blocks themselves live
 * in table-key-sections.ts, because they read the key objects of the table.
 */

export type TableSectionKind =
  | "primary"
  | "foreign"
  | "unique"
  | "index"
  | "description";

/** The height of the label line of a block. */
export const TABLE_SECTION_LABEL_HEIGHT = 18;
/** The height of one row of a block. */
export const TABLE_SECTION_LINE_HEIGHT = 16;
/** The vertical padding a block adds above and below its rows. */
export const TABLE_SECTION_PADDING_Y = 8;
/** The inset a description is wrapped at. */
export const TABLE_SECTION_INSET = TABLE_COMMENT_INSET;
/** A character of the description takes about 6px. */
const DESCRIPTION_CHAR_WIDTH = 6;

/** What a row of a key block selects: a field, or the relationship of a key. */
export type SectionRef =
  | { fieldId: string | number }
  | { relationshipId: string | number };

export interface TableSectionsInput {
  table: Table;
  layer: ViewLayer;
  toggles: ViewStateToggles;
  /** The width of the table, which the description wraps at. */
  width: number;
  /**
   * The rows of the foreign key block of the physical layer. The caller is
   * the one that sees the relationships and the names of the other tables,
   * so it passes the finished rows. `foreignKeyRefs` carries the
   * relationship of each of those rows, in the same order.
   */
  foreignKeys?: readonly string[];
  foreignKeyRefs?: readonly (string | number)[];
}

/** A block of the body of a table node below the field list. */
export interface TableSectionModel {
  kind: TableSectionKind;
  /** The short label of the block; the description block has none. */
  label: string | null;
  /** The rows of the block, e.g. `idx_email (email)`. */
  lines: string[];
  /** The text of the description block, when the block is a description. */
  text: string | null;
  /** The height the block adds to the table. */
  height: number;
  /**
   * The object each row stands for, so a click on a row can select it
   * (review issue 5). The description block has no refs.
   */
  refs: SectionRef[];
}

/** The number of lines the description of a block takes at a width. */
export function sectionDescriptionLines(text: string, width: number): number {
  if (!text) {
    return 0;
  }
  const usable = Math.max(1, width - TABLE_SECTION_INSET);
  const perLine = Math.max(1, Math.floor(usable / DESCRIPTION_CHAR_WIDTH));
  return text.split("\n").reduce((total, paragraph) => {
    return total + Math.max(1, Math.ceil(paragraph.length / perLine));
  }, 0);
}

export { foreignKeyRows } from "./table-foreign-keys.ts";

function descriptionSection(
  table: Table,
  layer: ViewLayer,
  toggles: ViewStateToggles,
  width: number,
): TableSectionModel | null {
  if (!toggles.description) {
    return null;
  }
  const text = (layer === "logical" ? table.logical?.description : table.comment)?.trim();
  if (!text) {
    return null;
  }
  const lines = sectionDescriptionLines(text, width);
  return {
    kind: "description",
    label: null,
    refs: [],
    lines: [],
    text,
    height: lines * TABLE_SECTION_LINE_HEIGHT + TABLE_SECTION_PADDING_Y,
  };
}

/** The blocks a table draws below its field list, in the documented order. */
export function tableSections(input: TableSectionsInput): TableSectionModel[] {
  const { table, layer, toggles, width } = input;
  const sections: (TableSectionModel | null)[] = [];
  if (toggles.pkUkFk) {
    sections.push(
      primarySection(table, layer),
      foreignSection(table, layer, input.foreignKeys, input.foreignKeyRefs),
      uniqueSection(table, layer),
    );
  }
  if (toggles.indexes) {
    sections.push(indexSection(table, layer));
  }
  sections.push(descriptionSection(table, layer, toggles, width));
  return sections.filter((section): section is TableSectionModel => section !== null);
}

/** The height the blocks add to a table. */
export function tableSectionsHeight(sections: readonly TableSectionModel[]): number {
  return sections.reduce((total, section) => total + section.height, 0);
}
