import { keyColumns } from "@drawdb/core";
import type { Table, ViewLayer } from "@drawdb/core";
import {
  TABLE_SECTION_LABEL_HEIGHT,
  TABLE_SECTION_LINE_HEIGHT,
  TABLE_SECTION_PADDING_Y,
} from "./table-sections.ts";
import type { SectionRef, TableSectionKind, TableSectionModel } from "./table-sections.ts";

/**
 * The key blocks of a table node (plan Task 7): the primary key, the
 * foreign keys, the unique keys and the indexes are drawn from the key
 * objects of the table, so the canvas and the panel name a key the same
 * way. The description block and the assembly stay in table-sections.ts.
 */
const NO_REF: SectionRef = { fieldId: "" };

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

export function primarySection(table: Table, layer: ViewLayer): TableSectionModel | null {

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
  const key = table.primaryKey;
  const columns = key === undefined ? [] : keyColumns(key);
  const ids = columns.map((column) => column.fieldId);
  const names = fieldList(fieldNames(table), ids);
  const label = key?.name ?? "PRIMARY";
  return keySection(
    "primary",
    "PK",
    ids.length > 0 ? [`${label} (${names})`] : [],
    ids.map((id) => ({ fieldId: id })),
    NO_REF,
  );
}

export function foreignSection(
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

export function uniqueSection(table: Table, layer: ViewLayer): TableSectionModel | null {

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
  for (const key of table.uniqueKeys ?? []) {
    const ids = keyColumns(key).map((column) => column.fieldId);
    if (ids.length === 0) continue;
    lines.push(`${key.name} (${fieldList(names, ids)})`);
    refs.push({ fieldId: ids[0] ?? "" });
    for (const id of ids) {
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

export function indexSection(table: Table, layer: ViewLayer): TableSectionModel | null {
  if (layer !== "physical") {
    // Indices are physical objects; the logical layer has NO_REF.
    return null;
  }
  const names = fieldNames(table);
  const lines: string[] = [];
  const refs: SectionRef[] = [];
  for (const index of table.indices ?? []) {
    const columns = keyColumns(index);
    const fields = columns
      .map((column) => {
        const name = fieldList(names, [column.fieldId]);
        return column.order === undefined
          ? name
          : `${name} ${column.order === "desc" ? "DESC" : "ASC"}`;
      })
      .join(", ");
    const body = index.name ? `${index.name} (${fields})` : `(${fields})`;
    lines.push(index.unique ? `${body} UNIQUE` : body);
    refs.push({ fieldId: columns[0]?.fieldId ?? "" });
  }
  return keySection("index", "INDEX", lines, refs, { fieldId: "" });
}

