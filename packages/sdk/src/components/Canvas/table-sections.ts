import type { Relationship, Table, ViewLayer, ViewStateToggles } from "@drawdb/core";
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
  /** The short label of the block; the description block has none. */
  label: string | null;
  /** The rows of the block, e.g. `idx_email (email)`. */
  lines: string[];
  /** The text of the description block, when the block is a description. */
  text: string | null;
  /** The height the block adds to the table. */
  height: number;
}

export interface TableSectionsInput {
  table: Table;
  layer: ViewLayer;
  toggles: ViewStateToggles;
  /** The width of the table, which the description wraps at. */
  width: number;
  /**
   * The rows of the foreign key block of the physical layer. The caller is
   * the one that sees the relationships and the names of the other tables,
   * so it passes the finished rows.
   */
  foreignKeys?: readonly string[];
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
  };
}

function primarySection(table: Table, layer: ViewLayer): TableSectionModel | null {
  if (layer === "logical") {
    const names = (table.logical?.attributes ?? [])
      .filter((attribute) => attribute.keyRole === "primary")
      .map((attribute) => attribute.name);
    return keySection("primary", "PK", names.length > 0 ? [`PRIMARY (${names.join(", ")})`] : []);
  }
  const names = table.fields
    .filter((field) => field.primary === true)
    .map((field) => field.name);
  return keySection("primary", "PK", names.length > 0 ? [`PRIMARY (${names.join(", ")})`] : []);
}

function foreignSection(
  table: Table,
  layer: ViewLayer,
  foreignKeys: readonly string[] | undefined,
): TableSectionModel | null {
  if (layer === "logical") {
    const names = (table.logical?.attributes ?? [])
      .filter((attribute) => attribute.keyRole === "foreign")
      .map((attribute) => attribute.name);
    return keySection("foreign", "FK", names);
  }
  return keySection("foreign", "FK", [...(foreignKeys ?? [])]);
}

function uniqueSection(table: Table, layer: ViewLayer): TableSectionModel | null {
  if (layer === "logical") {
    const names = (table.logical?.attributes ?? [])
      .filter((attribute) => attribute.keyRole === "alternate")
      .map((attribute) => attribute.name);
    return keySection("unique", "UK", names);
  }
  const names = fieldNames(table);
  const lines: string[] = [];
  const covered = new Set<string>();
  for (const constraint of table.uniqueConstraints ?? []) {
    const fields = fieldList(names, constraint.fields);
    lines.push(constraint.name ? `${constraint.name} (${fields})` : `(${fields})`);
    for (const id of constraint.fields) {
      covered.add(String(id));
    }
  }
  for (const field of table.fields) {
    if (field.unique === true && !covered.has(String(field.id))) {
      lines.push(field.name);
    }
  }
  return keySection("unique", "UK", lines);
}

function indexSection(table: Table, layer: ViewLayer): TableSectionModel | null {
  if (layer !== "physical") {
    // Indices are physical objects; the logical layer has none.
    return null;
  }
  const names = fieldNames(table);
  const lines = (table.indices ?? []).map((index) => {
    const fields = fieldList(names, index.fields);
    const body = index.name ? `${index.name} (${fields})` : `(${fields})`;
    return index.unique ? `${body} UNIQUE` : body;
  });
  return keySection("index", "INDEX", lines);
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
    lines: [],
    text,
    height: lines * TABLE_SECTION_LINE_HEIGHT + TABLE_SECTION_PADDING_Y,
  };
}

/**
 * The rows of the foreign key block of a table: one row per relationship
 * that leaves the table, `name: field → other.field`. The caller passes the
 * relationships and the tables, because the render model never reaches into
 * the diagram.
 */
export function foreignKeyRows(
  table: Table,
  relationships: readonly Relationship[],
  tables: readonly Table[],
): string[] {
  const byId = new Map(tables.map((entry) => [String(entry.id), entry]));
  const rows: string[] = [];
  for (const relationship of relationships) {
    if (String(relationship.startTableId) !== String(table.id)) {
      continue;
    }
    const field = table.fields.find(
      (entry) => String(entry.id) === String(relationship.startFieldId),
    );
    const other = byId.get(String(relationship.endTableId));
    const otherField = other?.fields.find(
      (entry) => String(entry.id) === String(relationship.endFieldId),
    );
    const name = relationship.name?.trim();
    const from = field?.name ?? String(relationship.startFieldId);
    const to = `${other?.name ?? String(relationship.endTableId)}.${
      otherField?.name ?? String(relationship.endFieldId)
    }`;
    rows.push(`${name ? `${name}: ` : ""}${from} → ${to}`);
  }
  return rows;
}

/** The blocks a table draws below its field list, in the documented order. */
export function tableSections(input: TableSectionsInput): TableSectionModel[] {
  const { table, layer, toggles, width, foreignKeys } = input;
  const sections: (TableSectionModel | null)[] = [];
  if (toggles.pkUkFk) {
    sections.push(
      primarySection(table, layer),
      foreignSection(table, layer, foreignKeys),
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
