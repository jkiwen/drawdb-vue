import type { OutlineNode } from "./outline-model.ts";

/**
 * The vector icon of an outline row (review of 2026-10-29, item 3): every
 * kind of element gets its own glyph so a reader can tell a table from a
 * note, a key from a field, without reading the label. The shapes are the
 * 16×16 paths of `outline-icon.vue`, kept here so the mapping is testable.
 */
export type OutlineIconName =
  | "table"
  | "fields"
  | "primary"
  | "unique"
  | "foreign"
  | "indexes"
  | "field"
  | "key"
  | "relationship"
  | "area"
  | "note"
  | "view"
  | "enum"
  | "type";

const KEY_ICONS: Record<string, OutlineIconName> = {
  primary: "primary",
  unique: "unique",
  foreign: "foreign",
  index: "indexes",
};

const CATEGORY_ICONS: Record<string, OutlineIconName> = {
  tables: "table",
  relationships: "relationship",
  areas: "area",
  notes: "note",
  views: "view",
  enums: "enum",
  types: "type",
};

/** The glyph of one row, chosen by its kind and, for the keys, by its group. */
export function iconOf(node: OutlineNode): OutlineIconName {
  switch (node.kind) {
    case "category":
      return CATEGORY_ICONS[node.category ?? "tables"] ?? "table";
    case "table":
      return "table";
    case "group":
      return node.group ?? "fields";
    case "constraint": {
      const kind = node.id.split(":")[2] ?? "";
      return KEY_ICONS[kind.split(":")[0] ?? ""] ?? "key";
    }
    case "field":
      return "field";
    case "relationship":
      return "relationship";
    case "area":
    case "area-table":
      return "area";
    case "note":
      return "note";
    case "view":
      return "view";
    case "enum":
      return "enum";
    case "type":
      return "type";
    default:
      return "table";
  }
}
