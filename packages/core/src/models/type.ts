import type { Metadata } from "./metadata.ts";

export type CustomTypeId = string | number;

export interface TypeField {
  id?: CustomTypeId;
  name: string;
  type: string;
  values?: string[];
  metadata?: Metadata;
}

export interface CustomType {
  id?: CustomTypeId;
  name: string;
  fields: TypeField[];
  comment?: string;
  metadata?: Metadata;
}
