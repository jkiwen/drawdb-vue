import { createId } from "../utils/id.ts";
import type { Diagram } from "./diagram.ts";
import type { FieldId } from "./field.ts";
import type { LogicalAttribute } from "./logical.ts";
import type { RelationshipId } from "./relationship.ts";
import type { Table, TableId } from "./table.ts";

/**
 * Structural invariants of the two-layer model (spec section 3.5).
 * The checker reports defects; it never mutates data. Import-side repair
 * rules (drop dangling references, dedupe) live with the importers.
 */
export type InvariantCode =
  | "INV-1"
  | "INV-2"
  | "INV-3"
  | "INV-4"
  | "INV-5"
  | "INV-6"
  | "INV-7";

export interface InvariantViolation {
  code: InvariantCode;
  message: string;
  tableId?: TableId;
  fieldId?: FieldId;
  attributeId?: string;
  relationshipId?: RelationshipId;
}

/**
 * Create a physical table with its embedded logical entity (INV-7
 * constructor guarantee, spec section 3.7.4).
 */
export function createTable(input: {
  id?: TableId;
  name: string;
  logicalName?: string;
  x?: number;
  y?: number;
}): Table {
  return {
    id: input.id ?? createId(),
    name: input.name,
    logical: {
      id: createId(),
      name: input.logicalName ?? input.name,
      attributes: [],
    },
    x: input.x ?? 0,
    y: input.y ?? 0,
    fields: [],
  };
}

/**
 * Build the O(1) pairing index fieldId -> attribute (spec section 3.5
 * implementation note). The first attribute wins; duplicates are reported
 * by `validateTableInvariants` as INV-4.
 */
export function buildAttributeIndex(
  table: Table,
): Map<FieldId, LogicalAttribute> {
  const index = new Map<FieldId, LogicalAttribute>();
  for (const attribute of table.logical?.attributes ?? []) {
    if (attribute.fieldId !== undefined && !index.has(attribute.fieldId)) {
      index.set(attribute.fieldId, attribute);
    }
  }
  return index;
}

/**
 * Delete a physical field together with its logical attribute in one
 * atomic step (INV-4 sync rule, spec section 3.5.2). Index and unique
 * constraint references to the field are cleaned as well. The input table
 * is not mutated.
 */
export function removeFieldAtomic(table: Table, fieldId: FieldId): Table {
  const fields = table.fields.filter((f) => f.id !== fieldId);
  const attributes = (table.logical?.attributes ?? []).filter(
    (a) => a.fieldId !== fieldId,
  );
  const withoutField = <T extends { fieldId: FieldId }>(columns: T[] | undefined) =>
    columns?.filter((column) => String(column.fieldId) !== String(fieldId));
  // An index that has not been migrated yet carries its ids in fields only;
  // its columns stay undefined instead of becoming an empty array.
  const columnsOf = <T extends { fieldId: FieldId }>(columns: T[] | undefined) =>
    columns === undefined ? [] : (withoutField(columns) ?? []);
  const indices = table.indices
    ?.map((ix) => ({
      ...ix,
      columns: ix.columns === undefined ? undefined : columnsOf(ix.columns),
      fields: (ix.fields ?? []).filter((id) => String(id) !== String(fieldId)),
    }))
    .filter((ix) => (ix.columns?.length ?? ix.fields?.length ?? 0) > 0);
  const uniqueKeys = table.uniqueKeys
    ?.map((uk) => ({ ...uk, columns: columnsOf(uk.columns) }))
    .filter((uk) => uk.columns.length > 0);
  const primaryKey = table.primaryKey
    ? { ...table.primaryKey, columns: columnsOf(table.primaryKey.columns) }
    : undefined;
  const uniqueConstraints = table.uniqueConstraints
    ?.map((uc) => ({ ...uc, fields: (uc.fields ?? []).filter((id) => String(id) !== String(fieldId)) }))
    .filter((uc) => (uc.fields?.length ?? 0) > 0);
  return {
    ...table,
    fields,
    logical: table.logical
      ? { ...table.logical, attributes }
      : table.logical,
    indices,
    // A key without columns is not a key any more, so an empty one is dropped;
    // a primary key keeps its place because the table still declares one.
    primaryKey: primaryKey?.columns.length ? primaryKey : undefined,
    uniqueKeys,
    uniqueConstraints,
  };
}

function duplicateValues<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return [...duplicates];
}

/**
 * Check the field/entity-level invariants INV-1..INV-5 and INV-7 of one
 * table (spec section 3.5). INV-5 is a legal state (divergent types on a
 * pair), so it never produces a violation; the lint layer reports it as a
 * hint instead (spec section 6).
 */
export function validateTableInvariants(table: Table): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const push = (v: InvariantViolation) =>
    violations.push({ tableId: table.id, ...v });

  if (!table.logical) {
    push({
      code: "INV-7",
      message: `table "${table.name}" has no embedded logical entity`,
    });
    return violations;
  }

  const fields = table.fields ?? [];
  const attributes = table.logical.attributes ?? [];

  for (const id of duplicateValues(fields.map((f) => f.id))) {
    push({
      code: "INV-2",
      fieldId: id,
      message: `duplicated physical field id "${String(id)}" in table "${table.name}"`,
    });
  }
  for (const id of duplicateValues(attributes.map((a) => a.id))) {
    push({
      code: "INV-2",
      attributeId: id,
      message: `duplicated logical attribute id "${id}" in entity "${table.logical.name}"`,
    });
  }
  for (const name of duplicateValues(fields.map((f) => f.name))) {
    push({
      code: "INV-3",
      message: `duplicated physical field name "${name}" in table "${table.name}"`,
    });
  }
  for (const name of duplicateValues(attributes.map((a) => a.name))) {
    push({
      code: "INV-3",
      message: `duplicated logical attribute name "${name}" in entity "${table.logical.name}"`,
    });
  }

  const fieldIds = new Set(fields.map((f) => f.id));
  const linkCount = new Map<FieldId, number>();
  for (const attribute of attributes) {
    if (attribute.fieldId === undefined) {
      if (!attribute.logicalOnly) {
        push({
          code: "INV-4",
          attributeId: attribute.id,
          message: `logical attribute "${attribute.name}" has no paired physical field`,
        });
      }
      continue;
    }
    if (!fieldIds.has(attribute.fieldId)) {
      push({
        code: "INV-1",
        attributeId: attribute.id,
        fieldId: attribute.fieldId,
        message: `logical attribute "${attribute.name}" references missing field "${String(attribute.fieldId)}"`,
      });
      continue;
    }
    linkCount.set(
      attribute.fieldId,
      (linkCount.get(attribute.fieldId) ?? 0) + 1,
    );
  }

  for (const field of fields) {
    const count = linkCount.get(field.id) ?? 0;
    if (count === 0 && !field.physicalOnly) {
      push({
        code: "INV-4",
        fieldId: field.id,
        message: `physical field "${field.name}" has no paired logical attribute`,
      });
    } else if (count > 1) {
      push({
        code: "INV-4",
        fieldId: field.id,
        message: `physical field "${field.name}" is referenced by ${count} logical attributes`,
      });
    }
  }

  return violations;
}

/**
 * Check INV-6: every logical relationship must pair with exactly one
 * physical relationship (same id), unless it is explicitly declared
 * `physicalPending` (spec sections 3.5, 3.7.4).
 */
export function validateRelationshipInvariants(
  diagram: Diagram,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const physicalIds = new Set(diagram.relationships.map((r) => r.id));
  for (const logical of diagram.logicalRelationships ?? []) {
    if (logical.physicalPending) {
      continue;
    }
    if (!physicalIds.has(logical.id)) {
      violations.push({
        code: "INV-6",
        relationshipId: logical.id,
        message: `logical relationship "${logical.name ?? String(logical.id)}" has no physical implementation and is not marked physicalPending`,
      });
    }
  }
  return violations;
}
