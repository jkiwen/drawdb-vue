import type { Metadata } from "./metadata.ts";

export type NoteId = string | number;

export interface Note {
  id: NoteId;
  x: number;
  y: number;
  title: string;
  content: string;
  color?: string;
  height?: number;
  width?: number;
  locked?: boolean;
  metadata?: Metadata;
}
