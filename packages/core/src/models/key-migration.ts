import type { Diagram } from "./diagram.ts";
import type { IndexColumn, Index, ForeignKey, PrimaryKey, UniqueKey } from "./keys.ts";
import { keyColumns } from "./keys.ts";
import { nextKeyName } from "./key-names.ts";
import type { KeyKind } from "./key-names.ts";
import type { Table } from "./table.ts";

/**
 * Moves a diagram from the old shape of its keys to the new one (spec section
 * 3.8.3, P2' task 2).
 *
 * The document used to keep a primary flag on each field and two arrays of
 * field ids for unique constraints and indexes; a key is now an object with an
 * id, two names and ordered columns. Loading rewrites the old shape once, so
 * every reader afterwards sees one shape only.
 *
 * The rewrite is additive: the old properties stay in place until the readers
 * are migrated (P2' tasks 5 and 6) and the model drops them (task 8). It is
 * idempotent — running it on a normalized diagram changes nothing — and it
 * never mutates its input.
 */

/** The name a physical reader sees. */
function physicalName(table: Table): string {
  return table.name ?? String(table.id ?? "");
}

/** The name a logical reader sees. */
function logicalName(table: Table): string {
  return table.logical?.name ?? physicalName(table);
}

/**
 * Every name the table already spends, so that an automatically named key does
 * not take one of them.
 */
function takenNames(table: Table): string[] {
  const names: (string | undefined)[] = [
    table.primaryKey?.name,
    ...(table.uniqueKeys ?? []).map((key) => key.name),
    ...(table.foreignKeys ?? []).map((key) => key.name),
    ...(table.indices ?? []).map((key) => key.name),
    ...(table.uniqueConstraints ?? []).map((key) => key.name),
  ];
  return names.filter((name): name is string => typeof name === "string" && name !== "");
}

/** The columns of an index, copied, whether it carries columns or field ids. */
function copiedColumns(index: Index): IndexColumn[] {
  return keyColumns(index).map((column) => ({ ...column }));
}

/**
 * The primary key a table implies through the primary flag of its fields, or
 * undefined when no field is primary. The flag is read in field order, which is
 * the order the columns of the key had before.
 */
function primaryKeyOf(table: Table, taken: string[]): PrimaryKey | undefined {
  if (table.primaryKey) {
    return {
      ...table.primaryKey,
      columns: table.primaryKey.columns.map((column) => ({ ...column })),
    };
  }
  const fieldIds = table.fields.filter((field) => field.primary === true).map((field) => field.id);
  if (fieldIds.length === 0) return undefined;
  return {
    id: `pk_${physicalName(table)}`,
    logicalName: nextKeyName("primary", logicalName(table), undefined, taken),
    name: nextKeyName("primary", physicalName(table), undefined, taken),
    columns: fieldIds.map((fieldId) => ({ fieldId })),
  };
}

/** The unique keys of a table: the new list, or the old constraints rewritten. */
function uniqueKeysOf(table: Table, taken: string[]): UniqueKey[] | undefined {
  if (table.uniqueKeys) {
    return table.uniqueKeys.map((key) => ({
      ...key,
      columns: key.columns.map((column) => ({ ...column })),
    }));
  }
  const constraints = table.uniqueConstraints ?? [];
  if (constraints.length === 0) return undefined;
  const used = [...taken];
  return constraints.map((constraint, at) => {
    const logical =
      constraint.name ||
      nextKeyName("unique", logicalName(table), undefined, used);
    const name =
      constraint.name || nextKeyName("unique", physicalName(table), undefined, used);
    // A generated name spends the next slot, so two unnamed constraints of one
    // table cannot take the same name.
    if (!constraint.name) {
      used.push(logical, name);
    }
    return {
      id: constraint.id !== undefined ? String(constraint.id) : `uk_${physicalName(table)}_${at + 1}`,
      logicalName: logical,
      name,
      columns: (constraint.fields ?? []).map((fieldId) => ({ fieldId })),
    };
  });
}

/** The keys of one table in the shape the model is moving to. */
export function normalizeTableKeys(table: Table): Table {
  const taken = takenNames(table);
  const indices = table.indices?.map((index, at) => ({
    ...index,
    id: index.id ?? `idx_${physicalName(table)}_${at + 1}`,
    logicalName:
      index.logicalName ?? nextKeyName("index", logicalName(table), undefined, taken),
    columns: copiedColumns(index),
  }));
  return {
    ...table,
    primaryKey: primaryKeyOf(table, taken),
    uniqueKeys: uniqueKeysOf(table, taken),
    indices,
  };
}

/**
 * The foreign keys a diagram implies through its relationships.
 *
 * A relationship is the anchor of the mapping, the cardinality and the cascade
 * rules, so the foreign key names the relationship instead of copying it; a
 * relationship and its foreign key are one to one (INV-10). Only the child side
 * holds the key: the parent side is what it points at.
 */
function foreignKeysOf(
  table: Table,
  diagram: Diagram,
  taken: string[],
): ForeignKey[] | undefined {
  if (table.foreignKeys?.length) return table.foreignKeys;
  const mine = diagram.relationships.filter(
    (relationship) => String(relationship.startTableId) === String(table.id),
  );
  if (mine.length === 0) return undefined;
  const used = [...taken];
  return mine.map((relationship) => {
    const parent = diagram.tables.find(
      (candidate) => String(candidate.id) === String(relationship.endTableId),
    );
    const kind: KeyKind = "foreign";
    const logical = nextKeyName(
      kind,
      logicalName(table),
      parent ? logicalName(parent) : undefined,
      used,
    );
    const name =
      relationship.name ||
      nextKeyName(kind, physicalName(table), parent ? physicalName(parent) : undefined, used);
    used.push(logical, name);
    return {
      id: `fk_${relationship.id}`,
      relationshipId: String(relationship.id),
      logicalName: logical,
      name,
    };
  });
}

/** The whole diagram in the shape the model is moving to. */
export function normalizeDiagramKeys(diagram: Diagram): Diagram {
  const tables = diagram.tables.map((table) => normalizeTableKeys(table));
  const keyed = tables.map((table) => ({
    ...table,
    foreignKeys: foreignKeysOf(table, { ...diagram, tables }, takenNames(table)),
  }));
  return { ...diagram, tables: keyed };
}
