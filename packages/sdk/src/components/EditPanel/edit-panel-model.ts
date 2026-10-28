import type {
  Area,
  DatabaseType,
  Diagram,
  Field,
  FieldId,
  LogicalAttribute,
  LogicalRelationship,
  PhysicalSpec,
  Relationship,
  Table,
  TypeParamKey,
} from "@drawdb/core";
import {
  DATABASE_TYPE_NAMES,
  buildAttributeIndex,
  emptyTypeScope,
  getTypeMetadata,
  resolveType,
} from "@drawdb/core";

// The pure derivation of the edit panel (plan Task 5): everything the
// components render is computed here; the writes live in edit-actions.ts.

/** A flattened view of the selection of the ui store. */
export interface SelectionSnapshot {
  tableIds: ReadonlyArray<string | number>;
  relationshipIds: ReadonlyArray<string | number>;
  areaIds: ReadonlyArray<string | number>;
  noteIds: ReadonlyArray<string | number>;
  fields: ReadonlyArray<{ tableId: string | number; fieldId: FieldId }>;
}

/**
 * What the panel shows for the current selection (design discussion
 * section 4.1): nothing, one table, several tables, one relationship or
 * one area. A single selected field shows the editor of its table with
 * the row of the field highlighted.
 */
export type PanelTarget =
  | { kind: "empty"; reason: "none" | "mixed" | "note" }
  | { kind: "table"; table: Table; focusFieldId?: FieldId }
  | { kind: "tables"; tables: Table[] }
  | {
      kind: "relationship";
      relationship: Relationship;
      logical?: LogicalRelationship;
    }
  | { kind: "area"; area: Area };

function byId<T extends { id: string | number }>(
  items: readonly T[],
  id: string | number,
): T | undefined {
  return items.find((item) => String(item.id) === String(id));
}

/** Resolves the current selection to the object the panel edits. */
export function resolvePanelTarget(
  selection: SelectionSnapshot,
  diagram: Diagram,
): PanelTarget {
  const { tableIds, relationshipIds, areaIds, noteIds, fields } = selection;
  const total =
    tableIds.length +
    relationshipIds.length +
    areaIds.length +
    noteIds.length +
    fields.length;

  if (total === 0) return { kind: "empty", reason: "none" };

  if (total > 1) {
    // The only multi selection the panel edits is a set of tables (Q12).
    if (tableIds.length === total && tableIds.length > 1) {
      const tables = tableIds
        .map((id) => byId(diagram.tables, id))
        .filter((table): table is Table => table !== undefined);
      if (tables.length > 1) return { kind: "tables", tables };
    }
    return { kind: "empty", reason: "mixed" };
  }

  if (tableIds.length === 1) {
    const table = byId(diagram.tables, tableIds[0]!);
    return table ? { kind: "table", table } : { kind: "empty", reason: "none" };
  }
  if (relationshipIds.length === 1) {
    const relationship = byId(diagram.relationships, relationshipIds[0]!);
    if (!relationship) return { kind: "empty", reason: "none" };
    const logical = (diagram.logicalRelationships ?? []).find(
      (item) => String(item.id) === String(relationship.id),
    );
    return { kind: "relationship", relationship, logical };
  }
  if (areaIds.length === 1) {
    const areas = diagram.areas ?? diagram.subjectAreas ?? [];
    const area = byId(areas, areaIds[0]!);
    return area ? { kind: "area", area } : { kind: "empty", reason: "none" };
  }
  if (noteIds.length === 1) return { kind: "empty", reason: "note" };

  const fieldSelection = fields[0]!;
  const table = byId(diagram.tables, fieldSelection.tableId);
  return table
    ? { kind: "table", table, focusFieldId: fieldSelection.fieldId }
    : { kind: "empty", reason: "none" };
}

/**
 * The status of one paired row of the fields group (design discussion
 * section 4.2/4.6).
 */
export type RowStatus =
  | "ok"
  | "missing-logical-name"
  | "diverged"
  | "logical-only"
  | "physical-only";

/** One row of the fields group: a physical field, its logical pair or both. */
export interface FieldPairRow {
  /** Stable key for the renderer. */
  key: string;
  field?: Field;
  attribute?: LogicalAttribute;
  status: RowStatus;
  /** The physical spec the logical type suggests, when the row diverged. */
  suggestion?: PhysicalSpec;
}

// The physical spec a logical attribute suggests for a dialect: the
// resolution of the core with an empty type scope (the sdk loads no
// custom domains yet). An unmapped result — a domain reference, an
// unknown family or a family without a dialect mapping — has no
// suggestion.
export function suggestPhysicalSpec(
  attribute: LogicalAttribute,
  database: DatabaseType,
): PhysicalSpec | undefined {
  const result = resolveType(attribute, database, emptyTypeScope());
  return result.unmapped ? undefined : result.suggested;
}

// Whether two physical specs describe the same type: case-insensitive on
// the name, strict on the sizing parameters; flags are never suggested.
export function physicalSpecsEqual(
  a: PhysicalSpec,
  b: PhysicalSpec,
): boolean {
  return (
    a.type.toUpperCase() === b.type.toUpperCase() &&
    a.length === b.length &&
    a.precision === b.precision &&
    a.scale === b.scale
  );
}

/**
 * Builds the paired rows of the fields group of a table (design section
 * 4.2). Physical fields keep their canvas order; logical attributes
 * without a physical counterpart follow at the end.
 */
export function buildFieldRows(
  table: Table,
  database: DatabaseType,
): FieldPairRow[] {
  const attributeByField = buildAttributeIndex(table);
  const paired = new Set<string>();

  const rows: FieldPairRow[] = table.fields.map((field) => {
    const attribute = attributeByField.get(field.id);
    if (attribute) paired.add(attribute.id);
    if (!attribute) {
      return { key: `field:${String(field.id)}`, field, status: "physical-only" };
    }
    if (attribute.name.trim() === "") {
      return {
        key: `field:${String(field.id)}`,
        field,
        attribute,
        status: "missing-logical-name",
      };
    }
    // Only a mapped type can silently diverge; an explicit or imported
    // type is the deliberate choice of the user (design section 4.6).
    if (field.fieldTypeSource === "mapped") {
      const suggestion = suggestPhysicalSpec(attribute, database);
      if (suggestion && !physicalSpecsEqual(suggestion, field.fieldType)) {
        return {
          key: `field:${String(field.id)}`,
          field,
          attribute,
          status: "diverged",
          suggestion,
        };
      }
    }
    return { key: `field:${String(field.id)}`, field, attribute, status: "ok" };
  });

  for (const attribute of table.logical?.attributes ?? []) {
    if (paired.has(attribute.id)) continue;
    rows.push({ key: `attr:${attribute.id}`, attribute, status: "logical-only" });
  }
  return rows;
}

/** The counts of the overview bar of the fields group (plan Task 5). */
export interface FieldOverview {
  total: number;
  paired: number;
  diverged: number;
  missingNames: number;
  text: string;
}

export function fieldOverview(rows: readonly FieldPairRow[]): FieldOverview {
  const total = rows.length;
  const paired = rows.filter(
    (row) => row.field !== undefined && row.attribute !== undefined,
  ).length;
  const diverged = rows.filter((row) => row.status === "diverged").length;
  const missingNames = rows.filter(
    (row) => row.status === "missing-logical-name",
  ).length;
  return {
    total,
    paired,
    diverged,
    missingNames,
    // TODO(i18n Task 7): replace the literal with an i18n key.
    text: `${total} fields: ${paired} paired, ${diverged} diverged`,
  };
}

/**
 * The options of the physical type combobox: the whitelist of the dialect
 * filtered incrementally by what the user typed (spec section 7.2.1).
 */
export function filterTypeOptions(
  database: DatabaseType,
  query: string,
  limit = 50,
): string[] {
  const all = DATABASE_TYPE_NAMES[database] ?? [];
  const needle = query.trim().toLowerCase();
  if (needle === "") return all.slice(0, limit);
  return all
    .filter((name) => name.toLowerCase().includes(needle))
    .slice(0, limit);
}

/** Which parameter inputs a physical type shows (isSized/hasPrecision). */
export function typeParamVisibility(
  database: DatabaseType,
  typeName: string,
): Record<TypeParamKey, boolean> {
  const metadata = getTypeMetadata(database, typeName);
  return {
    length: metadata?.isSized === true,
    precision: metadata?.hasPrecision === true,
    scale: metadata?.hasPrecision === true,
  };
}

// The shared value of a text property across a multi selection: the value
// when every object agrees, else the "multiple values" marker (design 4.7).
export function commonText(
  values: ReadonlyArray<string | undefined>,
): { value: string; multiple: boolean } {
  const normalized = values.map((value) => value ?? "");
  const first = normalized[0] ?? "";
  const multiple = normalized.some((value) => value !== first);
  return { value: multiple ? "" : first, multiple };
}
