import type {
  FieldId,
  PhysicalField,
  Relationship,
  RelationshipFieldPair,
  Table,
} from "@drawdb/core";

/**
 * The pure parts of the create forms in the constraints and indexes groups:
 * the name a new key starts with, the fields it can still take, and the
 * translation between the column pairs an editor shows and the four ids a
 * relationship stores.
 *
 * The naming mirrors what the canvas already does when a user draws a
 * relationship (`fk_<child>_<parent>`) and what PostgreSQL calls an index
 * (`idx_<table>_<n>`), so a key made in the panel reads the same as one made
 * on the canvas.
 */

const same = (a: FieldId | string | number, b: FieldId | string | number): boolean =>
  String(a) === String(b);

/** The first free `uk_<table>_<n>`. */
export function nextUniqueName(table: Table): string {
  const taken = new Set((table.uniqueKeys ?? []).map((key) => key.name));
  for (let n = 1; ; n += 1) {
    const name = `uk_${table.name}_${n}`;
    if (!taken.has(name)) return name;
  }
}

/** The first free `idx_<table>_<n>`. */
export function nextIndexName(table: Table): string {
  const taken = new Set((table.indices ?? []).map((index) => index.name));
  for (let n = 1; ; n += 1) {
    const name = `idx_${table.name}_${n}`;
    if (!taken.has(name)) return name;
  }
}

/** The name a relationship between a child and a parent starts with. */
export function defaultForeignKeyName(child: Table, parent: Table): string {
  return `fk_${child.name}_${parent.name}`;
}

/** The fields a key can still take. */
export function freeFields(
  fields: readonly PhysicalField[],
  taken: readonly FieldId[],
): PhysicalField[] {
  return fields.filter((field) => !taken.some((id) => same(id, field.id)));
}

/** The column pairs a relationship stores, with the four ids as the fallback. */
export function pairsOf(relationship: Relationship): RelationshipFieldPair[] {
  const pairs = relationship.fields;
  if (pairs && pairs.length > 0) {
    return pairs.map((pair) => ({ ...pair }));
  }
  return [
    {
      startFieldId: relationship.startFieldId,
      endFieldId: relationship.endFieldId,
    },
  ];
}

/**
 * The updates a relationship needs for a list of pairs: the first pair is
 * mirrored into the four ids, because the rest of the editor (and the canvas)
 * reads the relationship through them.
 */
export function syncPairs(pairs: readonly RelationshipFieldPair[]): {
  startFieldId: FieldId;
  endFieldId: FieldId;
  fields: RelationshipFieldPair[];
} {
  const list = pairs.map((pair) => ({ ...pair }));
  const first = list[0];
  return {
    startFieldId: first?.startFieldId ?? "",
    endFieldId: first?.endFieldId ?? "",
    fields: list,
  };
}

export function isPairComplete(pair: RelationshipFieldPair): boolean {
  return pair.startFieldId !== "" && pair.endFieldId !== "";
}

/** Whether the pairs of a foreign key can be saved. */
export function canSavePairs(pairs: readonly RelationshipFieldPair[]): boolean {
  if (pairs.length === 0) return false;
  if (!pairs.every(isPairComplete)) return false;
  const seen = new Set<string>();
  for (const pair of pairs) {
    const key = String(pair.startFieldId);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
