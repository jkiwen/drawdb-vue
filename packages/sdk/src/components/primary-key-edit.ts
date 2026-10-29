import type { FieldId, IndexColumn, Table } from "@drawdb/core";

/**
 * The primary key columns after a field is toggled in or out.
 *
 * The primary key is a key object on the table, so adding or removing a column
 * rewrites its column list; a field never carries a primary flag of its own.
 */
export function nextPrimaryColumns(
  table: Pick<Table, "primaryKey">,
  fieldId: FieldId,
  on: boolean,
): IndexColumn[] {
  const current = table.primaryKey?.columns ?? [];
  if (!on) {
    return current.filter((column) => String(column.fieldId) !== String(fieldId));
  }
  if (current.some((column) => String(column.fieldId) === String(fieldId))) {
    return [...current];
  }
  return [...current, { fieldId }];
}

/** The name to keep when the primary key is replaced, or the default label. */
export function primaryKeyName(table: Pick<Table, "primaryKey">): string {
  return table.primaryKey?.name ?? "PRIMARY";
}
