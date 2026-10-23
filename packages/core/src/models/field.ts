import type { Metadata } from "./metadata.ts";

export type FieldId = string | number;

export interface Field {
  id: FieldId;
  name: string;
  type: string;
  default?: string | number | boolean;
  check?: string;
  primary?: boolean;
  unique?: boolean;
  nullable?: boolean;
  notNull?: boolean;
  unsigned?: boolean;
  increment?: boolean;
  comment?: string;
  size?: string | number;
  values?: string[];
  metadata?: Metadata;
}
