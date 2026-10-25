import type { RelationshipId } from "@drawdb/core";

/** The state of a link that the user is drawing. */
export interface LinkingState {
  sourceTableId: RelationshipId;
  sourceFieldId: RelationshipId;
  pointer: { x: number; y: number };
}

/** The place where a link ends. */
export interface LinkingTarget {
  tableId: RelationshipId;
  fieldId?: RelationshipId;
}

/** The kind of the element whose corner the user grabs. */
export type ResizeKind = "table" | "area" | "note";

/** The element that the user resizes. */
export interface ResizeState {
  kind: ResizeKind;
  /** The id of the table, of the area or of the note. */
  id: RelationshipId;
  width: number;
  height: number;
}

/** The rectangle that the user draws to select several tables. */
export interface SelectionBox {
  active: boolean;
  origin: { x: number; y: number };
  current: { x: number; y: number };
}

/** The object the menu of the canvas was opened on. */
export interface ContextMenuTarget {
  kind: "table" | "field" | "canvas";
  tableId?: RelationshipId;
  fieldId?: RelationshipId;
}
