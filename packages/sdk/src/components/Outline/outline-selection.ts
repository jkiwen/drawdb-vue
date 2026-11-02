import type { OutlineNode } from "./outline-model.ts";

/**
 * The selection of the outline tree, kept out of the component so that
 * `OutlineTree.vue` stays inside the 300 line limit. The functions are pure:
 * they read the selection of the ui store and they write it back, they never
 * touch the diagram.
 */

/** The part of the ui store the outline reads and writes. */
export interface OutlineSelectionStore {
  selectedFields: { tableId: string; fieldId: string }[];
  selectedTableIds: readonly (string | number)[];
  selectedRelationshipIds: readonly (string | number)[];
  selectedNoteIds: readonly (string | number)[];
  selectedAreaIds: readonly (string | number)[];
  selectTable(id: string, additive?: boolean): void;
  selectRelationship(id: string, additive?: boolean): void;
  selectNote(id: string, additive?: boolean): void;
  selectArea(id: string, additive?: boolean): void;
  selectField(tableId: string, fieldId: string, additive?: boolean): void;
}

/** The payload the outline emits when a node is chosen. */
export interface OutlineFocus {
  kind: string;
  id: string | number;
  tableId?: string | number;
}

/**
 * The id of the node the outline shows as selected: the last selected field,
 * else the last selected table, relationship, note or area.
 */
export function outlineSelectionId(ui: OutlineSelectionStore): string | undefined {
  const field = ui.selectedFields[ui.selectedFields.length - 1];
  if (field) return `field:${field.tableId}:${field.fieldId}`;
  const last = (ids: readonly (string | number)[]) => ids[ids.length - 1];
  if (ui.selectedTableIds.length) return `table:${last(ui.selectedTableIds)}`;
  if (ui.selectedRelationshipIds.length)
    return `relationship:${last(ui.selectedRelationshipIds)}`;
  if (ui.selectedNoteIds.length) return `note:${last(ui.selectedNoteIds)}`;
  if (ui.selectedAreaIds.length) return `area:${last(ui.selectedAreaIds)}`;
  return undefined;
}

/** The focus a node produces: a constraint focuses its table, a field its table too. */
export function outlineFocusOf(node: OutlineNode): OutlineFocus {
  const kind =
    node.kind === "area-table" || node.kind === "constraint" ? "table" : node.kind;
  return {
    kind,
    id: (node.kind === "constraint" ? node.parentRefId : node.refId)!,
    ...(node.kind === "field" ? { tableId: node.parentRefId! } : {}),
  };
}

/**
 * Writes the selection of a node in the ui store and returns the focus the
 * component emits. A constraint selects its table and, when it is a foreign
 * key, the relationship it stands for.
 */
export function selectOutlineNode(
  ui: OutlineSelectionStore,
  node: OutlineNode,
): OutlineFocus {
  if (node.kind === "constraint") {
    // A key belongs to its table; a foreign key also selects the relationship (issue 8).
    ui.selectTable(String(node.parentRefId));
    if (node.id.includes(":foreign:")) ui.selectRelationship(String(node.refId));
  } else if (node.kind === "table" || node.kind === "area-table")
    ui.selectTable(String(node.refId));
  else if (node.kind === "field")
    ui.selectField(String(node.parentRefId), String(node.refId));
  else if (node.kind === "relationship") ui.selectRelationship(String(node.refId));
  else if (node.kind === "note") ui.selectNote(String(node.refId));
  else if (node.kind === "area") ui.selectArea(String(node.refId));
  // Views, enums and types have no ui-store selection yet; they only focus.
  return outlineFocusOf(node);
}
