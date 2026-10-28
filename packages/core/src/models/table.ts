import type { FieldId } from "./field.ts";
import type { LogicalEntity } from "./logical.ts";
import type { Metadata } from "./metadata.ts";
import type { PhysicalField } from "./physical.ts";

export type TableId = string | number;

export interface Index {
  id?: FieldId;
  name: string;
  unique: boolean;
  /** Field ids (spec section 3.8.3 ruling: name references become ids). */
  fields: FieldId[];
}

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
  uniqueConstraints?: UniqueConstraint[];
  color?: string;
  inherits?: string[];
  metadata?: Metadata;
}
