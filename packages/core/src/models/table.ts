import type { Field, FieldId } from "./field.ts";
import type { Metadata } from "./metadata.ts";

export type TableId = string | number;

export interface Index {
  id?: FieldId;
  name: string;
  unique: boolean;
  fields: string[];
}

export interface UniqueConstraint {
  id?: TableId;
  name: string;
  fields: string[];
}

export interface Table {
  id: TableId;
  name: string;
  x: number;
  y: number;
  width?: number;
  fields: Field[];
  comment?: string;
  locked?: boolean;
  hidden?: boolean;
  collapsed?: boolean;
  indices?: Index[];
  uniqueConstraints?: UniqueConstraint[];
  color?: string;
  inherits?: string[];
  metadata?: Metadata;
}
