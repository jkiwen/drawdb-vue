import type { FieldId } from "./field.ts";
import type { Table } from "./table.ts";
import type { KeyKind } from "./key-names.ts";

/** How a database can build an index (spec section 3.8.3, ruling 1). */
export type IndexType =
  | "btree"
  | "hash"
  | "gist"
  | "gin"
  | "brin"
  | "fulltext"
  | "spatial";

/** One column of a key: a field by id, with an optional direction or expression. */
export interface IndexColumn {
  fieldId: FieldId;
  order?: "asc" | "desc";
  /** The expression of a functional index; the field is then only a stand-in. */
  expression?: string;
}

/**
 * An index is a physical object of the database that serves a business query
 * (spec section 3.8.3). It has two names — one the readers of the model use,
 * one the database does — and its columns are ordered.
 *
 * `id`, `logicalName` and `columns` are the shape the model is moving to; while
 * the call sites are migrated they stay optional and the loader fills them from
 * `fields` (`normalizeTableKeys`). Once every reader uses `columns` they become
 * required and `fields` goes away (P2' task 8).
 */
export interface Index {
  id?: FieldId;
  /** The name the design reads: "Idx_" plus the logical table name by default. */
  logicalName?: string;
  /** The name the database reads: "Idx_" plus the physical table name by default. */
  name: string;
  /** The covered columns, in index order. */
  columns?: IndexColumn[];
  /** @deprecated field ids from before P2'; only the migration reads them. */
  fields?: FieldId[];
  unique: boolean;
  type?: IndexType;
  /** The predicate of a partial index, in SQL. */
  where?: string;
  /** The ids of the included (non-key) columns. */
  include?: FieldId[];
  /** The text of a key group definition, carried on the physical index. */
  comment?: string;
  /** The relationship this index supports, when it backs a foreign key. */
  supportsRelationshipId?: string;
}

/** The primary key of a table; at most one per table (INV-9). */
export interface PrimaryKey {
  id: string;
  logicalName: string;
  name: string;
  columns: IndexColumn[];
  /** The index object that carries the index-only properties of the key. */
  indexId?: string;
  comment?: string;
}

/** A unique constraint: an inline `CONSTRAINT … UNIQUE`, not a unique index. */
export interface UniqueKey {
  id: string;
  logicalName: string;
  name: string;
  columns: IndexColumn[];
  comment?: string;
}

/**
 * A named foreign key constraint. The columns, the cardinality and the cascade
 * rules stay on the relationship it points at: two copies of the mapping would
 * have to be kept in step, and the relationship is already the anchor of INV-6.
 * A relationship and its foreign key are one to one (INV-10).
 */
export interface ForeignKey {
  id: string;
  logicalName: string;
  name: string;
  relationshipId: string;
  comment?: string;
}

/** The keys a table holds of one kind, in display order. */
export interface KeyChannel {
  kind: KeyKind;
  keys: readonly (PrimaryKey | UniqueKey | ForeignKey | Index)[];
}

/**
 * The columns of a key, in its order; a foreign key has none of its own.
 *
 * An index that still carries `fields` is read as columns of that order: the
 * migration has not touched it yet, and a reader that ignored it would draw an
 * index without columns.
 */
export function keyColumns(
  key: PrimaryKey | UniqueKey | ForeignKey | Index,
): IndexColumn[] {
  if ("columns" in key && key.columns) return [...key.columns];
  if ("fields" in key && key.fields) {
    return key.fields.map((fieldId) => ({ fieldId }));
  }
  return [];
}

/**
 * The field ids an index covers, in its order. An index that still carries its
 * ids in `fields` is read the same way, so the readers can move before the
 * migration does.
 */
export function indexFields(index: Index): FieldId[] {
  return keyColumns(index).map((column) => column.fieldId);
}

/**
 * The keys of a table, one channel per kind. Every kind appears even when it is
 * empty, so a reader can tell "no unique key" apart from "the model forgot to
 * look".
 */
export function keyChannelsOf(table: Table): KeyChannel[] {
  return [
    { kind: "primary", keys: table.primaryKey ? [table.primaryKey] : [] },
    { kind: "unique", keys: table.uniqueKeys ?? [] },
    { kind: "foreign", keys: table.foreignKeys ?? [] },
    { kind: "index", keys: table.indices ?? [] },
  ];
}
