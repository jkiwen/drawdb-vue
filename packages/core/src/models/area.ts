import type { Metadata } from "./metadata.ts";

export type AreaId = string | number;

export interface Area {
  id: AreaId;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  color?: string;
  metadata?: Metadata;
}
