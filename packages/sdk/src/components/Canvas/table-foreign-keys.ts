import type { Relationship, Table } from "@drawdb/core";

/**
 * The rows of the foreign key block of a table, and the relationship each
 * row stands for (review issue 5): one row per relationship that leaves the
 * table, `name: field → other.field`.
 *
 * The caller passes the relationships and the tables, because the render
 * model never reaches into the diagram.
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

/** The relationship of every row `foreignKeyRows` produced, in the same order. */
export function foreignKeyRefs(
  table: Table,
  relationships: readonly Relationship[],
): (string | number)[] {
  return relationships
    .filter(
      (relationship) => String(relationship.startTableId) === String(table.id),
    )
    .map((relationship) => relationship.id);
}
