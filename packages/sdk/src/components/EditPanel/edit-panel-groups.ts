import type {
  FieldTypeSource,
  Relationship,
  Table,
} from "@drawdb/core";

// The derived lists of the constraint, index and appearance groups of the
// edit panel (plan Task 5). Everything here is a pure read of the diagram;
// the writes stay in edit-actions.ts.

/** One row of the constraints group. */
export interface ConstraintRow {
  kind: "primary" | "unique" | "foreign";
  /** Stable key of the renderer: kind plus the name or the field ids. */
  id: string;
  /** The physical name, "PRIMARY" for the primary key. */
  name: string;
  /** The physical field names of the constraint. */
  fields: string[];
}

/** One row of the indexes group. */
export interface IndexRow {
  id: string;
  name: string;
  unique: boolean;
  fields: string[];
}

/**
 * The constraints of one table as the panel lists them (design section
 * 7): the primary key from the field flags, the unique constraints, and
 * the foreign keys, which belong to the child side of the relationship.
 */
export function tableConstraints(
  table: Table,
  relationships: readonly Relationship[],
): ConstraintRow[] {
  const nameOf = (fieldId: unknown): string => {
    const field = table.fields.find(
      (candidate) => String(candidate.id) === String(fieldId),
    );
    return field?.name ?? String(fieldId);
  };

  const rows: ConstraintRow[] = [];
  const primary = table.fields.filter((field) => field.primary === true);
  if (primary.length > 0) {
    rows.push({
      kind: "primary",
      id: "primary",
      name: "PRIMARY",
      fields: primary.map((field) => field.name),
    });
  }

  for (const unique of table.uniqueConstraints ?? []) {
    rows.push({
      kind: "unique",
      id: `unique:${unique.name}`,
      name: unique.name,
      fields: unique.fields.map(nameOf),
    });
  }

  for (const relationship of relationships) {
    if (String(relationship.startTableId) !== String(table.id)) continue;
    const pairs = relationship.fields ?? [
      {
        startFieldId: relationship.startFieldId,
        endFieldId: relationship.endFieldId,
      },
    ];
    rows.push({
      kind: "foreign",
      id: `foreign:${String(relationship.id)}`,
      name: relationship.name ?? `fk_${String(relationship.id)}`,
      fields: pairs.map((pair) => nameOf(pair.startFieldId)),
    });
  }
  return rows;
}

/** The indexes of one table, with their field ids resolved to names. */
export function tableIndexes(table: Table): IndexRow[] {
  return (table.indices ?? []).map((index) => ({
    id: String(index.id ?? index.name),
    name: index.name,
    unique: index.unique === true,
    fields: index.fields.map((fieldId) => {
      const field = table.fields.find(
        (candidate) => String(candidate.id) === String(fieldId),
      );
      return field?.name ?? String(fieldId);
    }),
  }));
}

/** The shared appearance values of a multi selection (design 4.7). */
export interface AppearanceValues {
  color: string;
  colorMultiple: boolean;
  locked: boolean;
  lockedMultiple: boolean;
  details: boolean;
  detailsMultiple: boolean;
}

function shared<T>(
  values: ReadonlyArray<T>,
  fallback: T,
): { value: T; multiple: boolean } {
  const first = values[0] ?? fallback;
  const multiple = values.some((value) => value !== first);
  return { value: multiple ? fallback : first, multiple };
}

export function appearanceValues(tables: readonly Table[]): AppearanceValues {
  const color = shared(
    tables.map((table) => table.color ?? ""),
    "",
  );
  const locked = shared(
    tables.map((table) => table.locked === true),
    false,
  );
  const details = shared(
    tables.map((table) => table.details === true),
    false,
  );
  return {
    color: color.value,
    colorMultiple: color.multiple,
    locked: locked.value,
    lockedMultiple: locked.multiple,
    details: details.value,
    detailsMultiple: details.multiple,
  };
}

/** The i18n key of the type-source badge of a field (ruling Q19). */
export function sourceKey(source: FieldTypeSource): string {
  return `edit_panel_source_${source}`;
}

/** The composition of a selection that mixes object types (design 4.7). */
export interface MixedCounts {
  tables: number;
  relationships: number;
  areas: number;
  notes: number;
  fields: number;
}

/**
 * The non-empty parts of a mixed selection, with the i18n key of their
 * label — the panel lists what is selected instead of a bare message.
 */
export function mixedEntries(
  counts: MixedCounts,
): Array<{ key: keyof MixedCounts; count: number }> {
  return (Object.keys(counts) as Array<keyof MixedCounts>)
    .filter((key) => counts[key] > 0)
    .map((key) => ({ key, count: counts[key] }));
}
