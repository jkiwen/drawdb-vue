import type { Metadata } from "./metadata.ts";

export type ViewId = string | number;

export interface ViewJoin {
  id?: ViewId;
  type: string;
  tableId?: ViewId | null;
  on?: {
    leftTableId: ViewId;
    leftFieldId: ViewId;
    rightFieldId: ViewId;
  } | null;
}

export interface ViewColumn {
  id?: ViewId;
  tableId?: ViewId | null;
  fieldId?: ViewId | null;
  alias?: string;
}

export interface ViewCondition {
  id?: ViewId;
  connector?: string;
  tableId?: ViewId | null;
  fieldId?: ViewId | null;
  operator?: string;
  value?: string | number;
}

export interface View {
  id: ViewId;
  name: string;
  x: number;
  y: number;
  width?: number;
  baseTableId?: ViewId | null;
  joins?: ViewJoin[];
  columns?: ViewColumn[];
  conditions?: ViewCondition[];
  comment?: string;
  materialized?: boolean;
  locked?: boolean;
  hidden?: boolean;
  color?: string;
  metadata?: Metadata;
}
