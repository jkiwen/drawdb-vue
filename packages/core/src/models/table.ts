import type { FieldId } from "./field.ts";
import type { ForeignKey, Index, PrimaryKey, UniqueKey } from "./keys.ts";
import type { LogicalEntity } from "./logical.ts";
import type { Metadata } from "./metadata.ts";
import type { PhysicalField } from "./physical.ts";

export type TableId = string | number;

export type { ForeignKey, Index, IndexColumn, IndexType, PrimaryKey, UniqueKey } from "./keys.ts";

/** @deprecated superseded by UniqueKey (P2'); the loader rewrites it. */
export interface UniqueConstraint {
  id?: TableId;
  name: string;
  /** Field ids (see Index.fields). */
  fields: FieldId[];
}

export interface Table {
  id: TableId;
  /** The physical table name (erwin: Table.Name); SQL export uses it. */
  name: string;
  /**
   * The embedded logical entity, one-to-one with this physical table
   * (INV-7, spec section 3.7.4). Created by `createTable`.
   */
  logical: LogicalEntity;
  x: number;
  y: number;
  width?: number;
  /** Physical fields (the physical layer, spec section 3.4). */
  fields: PhysicalField[];
  comment?: string;
  locked?: boolean;
  hidden?: boolean;
  collapsed?: boolean;
  /** Whether the details of the table are shown on the canvas. */
  details?: boolean;
  indices?: Index[];
  /** The primary key object; replaces the primary flag of a field (INV-9). */
  primaryKey?: PrimaryKey;
  /** Unique constraints: inline CONSTRAINT ... UNIQUE, not unique indexes. */
  uniqueKeys?: UniqueKey[];
  /** The foreign keys this table holds as the child side of a relationship (INV-10). */
  foreignKeys?: ForeignKey[];
  /** @deprecated the loader turns each entry into a UniqueKey (P2'). */
  uniqueConstraints?: UniqueConstraint[];
  color?: string;
  inherits?: string[];
  metadata?: Metadata;
}
