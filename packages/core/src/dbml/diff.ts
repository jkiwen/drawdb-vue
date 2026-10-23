import type { Diagram } from "../models/diagram.ts";
import type { Enum } from "../models/enum.ts";
import type { Field } from "../models/field.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";

const TABLE_KEYS = [
  "name",
  "comment",
  "color",
  "indices",
  "uniqueConstraints",
] as const;

const FIELD_KEYS = [
  "name",
  "type",
  "size",
  "default",
  "primary",
  "unique",
  "notNull",
  "increment",
  "comment",
  "values",
] as const;

const RELATIONSHIP_KEYS = [
  "name",
  "startTableId",
  "endTableId",
  "startFieldId",
  "endFieldId",
  "fields",
  "cardinality",
  "updateConstraint",
  "deleteConstraint",
] as const;

export interface DBMLDiffEnumUpdate {
  target: "enums";
  action: "update";
  enums: Enum[];
}

export interface DBMLDiffTableDelete {
  target: "table";
  action: "delete";
  id: string | number;
}

export interface DBMLDiffTableCreate {
  target: "table";
  action: "create";
  table: Table;
}

export interface DBMLDiffTableUpdate {
  target: "table";
  action: "update";
  id: string | number;
  values: Record<string, unknown>;
}

export interface DBMLDiffFieldUpdate {
  target: "field";
  action: "update";
  tableId: string | number;
  fieldId: string | number;
  values: Record<string, unknown>;
}

export interface DBMLDiffRelationshipDelete {
  target: "relationship";
  action: "delete";
  id: string | number;
}

export interface DBMLDiffRelationshipCreate {
  target: "relationship";
  action: "create";
  relationship: Relationship;
}

export interface DBMLDiffRelationshipUpdate {
  target: "relationship";
  action: "update";
  id: string | number;
  values: Record<string, unknown>;
}

export type DBMLDiffOperation =
  | DBMLDiffEnumUpdate
  | DBMLDiffTableDelete
  | DBMLDiffTableCreate
  | DBMLDiffTableUpdate
  | DBMLDiffFieldUpdate
  | DBMLDiffRelationshipDelete
  | DBMLDiffRelationshipCreate
  | DBMLDiffRelationshipUpdate;

export type DBMLDiff = DBMLDiffOperation[];

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isEqual(item, b[i]));
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) =>
        isEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    );
  }

  return false;
}

function changedValues(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    if (!isEqual(before[key], after[key])) values[key] = after[key];
  }
  return values;
}

function byId<T extends { id: string | number }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function diffFields(before: Table, after: Table) {
  const beforeFields = before.fields ?? [];
  const afterFields = after.fields ?? [];

  const sameShape =
    beforeFields.length === afterFields.length &&
    beforeFields.every((field, i) => field.id === afterFields[i].id);
  if (!sameShape) return { replaceFields: true, updates: [] as DBMLDiffFieldUpdate[] };

  const updates: DBMLDiffFieldUpdate[] = [];
  afterFields.forEach((field: Field, i) => {
    const values = changedValues(
      beforeFields[i] as unknown as Record<string, unknown>,
      field as unknown as Record<string, unknown>,
      FIELD_KEYS,
    );
    if (Object.keys(values).length) {
      updates.push({
        target: "field",
        action: "update",
        tableId: after.id,
        fieldId: field.id,
        values,
      });
    }
  });

  return { replaceFields: false, updates };
}

function diffTables(before: Table[], after: Table[]) {
  const beforeById = byId(before);
  const afterById = byId(after);

  const deletes: DBMLDiffTableDelete[] = before
    .filter((table) => !afterById.has(table.id))
    .map((table) => ({ target: "table", action: "delete", id: table.id }));

  const creates: DBMLDiffTableCreate[] = after
    .filter((table) => !beforeById.has(table.id))
    .map((table) => ({ target: "table", action: "create", table }));

  const updates: DBMLDiffTableUpdate[] = [];
  const fieldUpdates: DBMLDiffFieldUpdate[] = [];

  for (const table of after) {
    const previous = beforeById.get(table.id);
    if (!previous) continue;

    const values = changedValues(
      previous as unknown as Record<string, unknown>,
      table as unknown as Record<string, unknown>,
      TABLE_KEYS,
    );
    const fields = diffFields(previous, table);
    if (fields.replaceFields) values.fields = table.fields;
    else fieldUpdates.push(...fields.updates);

    if (Object.keys(values).length) {
      updates.push({ target: "table", action: "update", id: table.id, values });
    }
  }

  return { deletes, creates, updates, fieldUpdates };
}

function diffRelationships(before: Relationship[], after: Relationship[]) {
  const beforeById = byId(before);
  const afterById = byId(after);

  const deletes: DBMLDiffRelationshipDelete[] = before
    .filter((rel) => !afterById.has(rel.id))
    .map((rel) => ({ target: "relationship", action: "delete", id: rel.id }));

  const creates: DBMLDiffRelationshipCreate[] = after
    .filter((rel) => !beforeById.has(rel.id))
    .map((rel) => ({
      target: "relationship",
      action: "create",
      relationship: rel,
    }));

  const updates: DBMLDiffRelationshipUpdate[] = [];
  for (const rel of after) {
    const previous = beforeById.get(rel.id);
    if (!previous) continue;

    const values = changedValues(
      previous as unknown as Record<string, unknown>,
      rel as unknown as Record<string, unknown>,
      RELATIONSHIP_KEYS,
    );
    if (Object.keys(values).length) {
      updates.push({
        target: "relationship",
        action: "update",
        id: rel.id,
        values,
      });
    }
  }

  return { deletes, creates, updates };
}

/**
 * Compute the difference between two diagrams.
 *
 * The result is a flat list of operations that can be applied to `from` to
 * turn it into `to`. Field level changes are reported separately so that a
 * consumer can update single fields instead of replacing whole field lists.
 */
export function diffDBML(from: Diagram, to: Diagram): DBMLDiff {
  const enums: DBMLDiffEnumUpdate[] = isEqual(from.enums ?? [], to.enums ?? [])
    ? []
    : [{ target: "enums", action: "update", enums: to.enums ?? [] }];

  const tables = diffTables(from.tables ?? [], to.tables ?? []);
  const relationships = diffRelationships(
    from.relationships ?? [],
    to.relationships ?? [],
  );

  return [
    ...enums,
    ...tables.deletes,
    ...tables.creates,
    ...tables.updates,
    ...tables.fieldUpdates,
    ...relationships.deletes,
    ...relationships.creates,
    ...relationships.updates,
  ];
}
