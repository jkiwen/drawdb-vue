/** The kinds of key a table can hold (spec section 3.8.3, rulings 1 and 2). */
export type KeyKind = "primary" | "unique" | "foreign" | "index";

const PREFIXES: Record<KeyKind, string> = {
  primary: "PK_",
  unique: "UK_",
  foreign: "FK_",
  index: "Idx_",
};

/** The prefix an automatically named key of this kind starts with. */
export function keyPrefix(kind: KeyKind): string {
  return PREFIXES[kind];
}

/**
 * The default name of a new key: the prefix and the table name, with `_2`,
 * `_3`… appended when the name is taken.
 *
 * A foreign key joins both tables in its name (`FK_posts_users`) because the
 * physical constraint name has to read on its own in a schema listing. The
 * comparison is case-insensitive: SQL identifiers that differ only in case are
 * the same name in most dialects, and two constraints that differ only in case
 * would fail the schema-level uniqueness check (INV-8).
 *
 * A name is materialised when the key is created and never follows a rename of
 * the table afterwards: a reader who renamed the key by hand would otherwise
 * lose that name to a rename they did not connect to it (ruling 1, point 3).
 */
export function nextKeyName(
  kind: KeyKind,
  tableName: string,
  parentName?: string,
  taken: readonly string[] = [],
): string {
  const joined =
    kind === "foreign" && parentName ? `${tableName}_${parentName}` : tableName;
  const base = `${PREFIXES[kind]}${joined}`;
  const used = new Set(taken.map((name) => name.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (used.has(`${base}_${suffix}`.toLowerCase())) suffix += 1;
  return `${base}_${suffix}`;
}
