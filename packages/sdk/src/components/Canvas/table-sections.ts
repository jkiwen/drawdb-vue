import { indexFields } from "@drawdb/core";
import type { Table, ViewLayer, ViewStateToggles } from "@drawdb/core";
import {
  TABLE_COMMENT_INSET,
} from "./table-comment.ts";

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
 * `description` shows the description block.
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

/** A block of the body of a table node below the field list. */
export interface TableSectionModel {
  kind: TableSectionKind;
  /** The short label of the block; the description block has NO_REF. */
  label: string | null;
  /** The rows of the block, e.g. `idx_email (email)`. */
  lines: string[];
  /** The text of the description block, when the block is a description. */
  text: string | null;
  /** The height the block adds to the table. */
  height: number;
  /**
   * The object each row stands for, so a click on a row can select it
   * (review issue 5). The description block has NO_REF.
   */
  refs: SectionRef[];
}

/** The rows that stand for no selectable object (a name without a field). */
const NO_REF: SectionRef = { fieldId: "" };

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

/** The names of the fields of a table, by id. */
function fieldNames(table: Table): Map<string, string> {
  const names = new Map<string, string>();
  for (const field of table.fields) {
    names.set(String(field.id), field.name);
  }
  return names;
}

/** One row per field id, joined by a comma, with `?` for an unknown id. */
function fieldList(names: Map<string, string>, ids: readonly (string | number)[]): string {
  return ids.map((id) => names.get(String(id)) ?? "?").join(", ");
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

function keySection(
  kind: TableSectionKind,
  label: string,
  lines: string[],
  refs: SectionRef[],
  fallback: SectionRef,
): TableSectionModel | null {
  if (lines.length === 0) {
    return null;
  }
  return {
    kind,
    label,
    lines,
    text: null,
    height: TABLE_SECTION_LABEL_HEIGHT +
      lines.length * TABLE_SECTION_LINE_HEIGHT +
      TABLE_SECTION_PADDING_Y,
    refs: lines.map((_, index) => refs[index] ?? fallback),
  };
}

function primarySection(table: Table, layer: ViewLayer): TableSectionModel | null {

  if (layer === "logical") {
    const attributes = (table.logical?.attributes ?? []).filter(
      (attribute) => attribute.keyRole === "primary",
    );
    const names = attributes.map((attribute) => attribute.name);
    const refs = attributes.map((attribute) =>
      attribute.fieldId === undefined ? NO_REF : { fieldId: attribute.fieldId },
    );
    return keySection(
      "primary",
      "PK",
      names.length > 0 ? [`PRIMARY (${names.join(", ")})`] : [],
      refs,
      NO_REF,
    );
  }
  const fields = table.fields.filter((field) => field.primary === true);
  const names = fields.map((field) => field.name);
  return keySection(
    "primary",
    "PK",
    names.length > 0 ? [`PRIMARY (${names.join(", ")})`] : [],
    fields.map((field) => ({ fieldId: field.id })),
    NO_REF,
  );
}

function foreignSection(
  table: Table,
  layer: ViewLayer,
  foreignKeys: readonly string[] | undefined,
  foreignKeyRefs: readonly (string | number)[] | undefined,
): TableSectionModel | null {

  if (layer === "logical") {
    const attributes = (table.logical?.attributes ?? []).filter(
      (attribute) => attribute.keyRole === "foreign",
    );
    return keySection(
      "foreign",
      "FK",
      attributes.map((attribute) => attribute.name),
      attributes.map((attribute) =>
        attribute.fieldId === undefined ? NO_REF : { fieldId: attribute.fieldId },
      ),
      NO_REF,
    );
  }
  const lines = [...(foreignKeys ?? [])];
  const refs = lines.map((_, index) => {
    const id = foreignKeyRefs?.[index];
    return id === undefined ? NO_REF : { relationshipId: id };
  });
  return keySection("foreign", "FK", lines, refs, NO_REF);
}

function uniqueSection(table: Table, layer: ViewLayer): TableSectionModel | null {

  if (layer === "logical") {
    const attributes = (table.logical?.attributes ?? []).filter(
      (attribute) => attribute.keyRole === "alternate",
    );
    return keySection(
      "unique",
      "UK",
      attributes.map((attribute) => attribute.name),
      attributes.map((attribute) =>
        attribute.fieldId === undefined ? NO_REF : { fieldId: attribute.fieldId },
      ),
      NO_REF,
    );
  }
  const names = fieldNames(table);
  const lines: string[] = [];
  const refs: SectionRef[] = [];
  const covered = new Set<string>();
  for (const constraint of table.uniqueConstraints ?? []) {
    const fields = fieldList(names, constraint.fields);
    lines.push(constraint.name ? `${constraint.name} (${fields})` : `(${fields})`);
    refs.push({ fieldId: constraint.fields[0] ?? "" });
    for (const id of constraint.fields) {
      covered.add(String(id));
    }
  }
  for (const field of table.fields) {
    if (field.unique === true && !covered.has(String(field.id))) {
      lines.push(field.name);
      refs.push({ fieldId: field.id });
    }
  }
  return keySection("unique", "UK", lines, refs, NO_REF);
}

function indexSection(table: Table, layer: ViewLayer): TableSectionModel | null {
  if (layer !== "physical") {
    // Indices are physical objects; the logical layer has NO_REF.
    return null;
  }
  const names = fieldNames(table);
  const lines: string[] = [];
  const refs: SectionRef[] = [];
  for (const index of table.indices ?? []) {
    const fields = fieldList(names, indexFields(index));
    const body = index.name ? `${index.name} (${fields})` : `(${fields})`;
    lines.push(index.unique ? `${body} UNIQUE` : body);
    refs.push({ fieldId: indexFields(index)[0] ?? "" });
  }
  return keySection("index", "INDEX", lines, refs, { fieldId: "" });
}

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

export { foreignKeyRows } from "./table-foreign-keys.ts";

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
