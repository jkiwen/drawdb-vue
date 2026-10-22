import type { Metadata } from "./metadata.ts";

export type EnumId = string | number;

export interface Enum {
  id?: EnumId;
  name: string;
  values: string[];
  metadata?: Metadata;
}
