import { useDiagramStore } from "../stores/diagram.ts";
import { useUIStore } from "../stores/ui.ts";

/** The node the outline asks the canvas to locate. */
export interface OutlineFocusTarget {
  kind: string;
  id: string | number;
  tableId?: string | number;
}

/** The drag assignment the outline reports (Q11: table into area only). */
export interface OutlineAreaAssignment {
  tableId: string | number;
  areaId: string | number;
}

/**
 * The wiring between the outline tree and the canvas (design 3.2).
 *
 * A click on the outline already selected the object in the ui store, the
 * focus handler here only scrolls the canvas to it. A relationship has no
 * coordinates of its own, so the scroll target is its start table. Areas
 * and notes carry their own coordinates.
 *
 * The membership of an area is geometric (a table belongs to the area its
 * bounds fall into), so the drag assignment moves the table into the area,
 * stacked below the members the area already holds, through the undoable
 * updateTable command.
 */
export function useOutlineIntegration(): {
  focusOutlineNode: (payload: OutlineFocusTarget) => void;
  assignTableToArea: (payload: OutlineAreaAssignment) => void;
} {
  const diagramStore = useDiagramStore();
  const ui = useUIStore();

  function focusOutlineNode(payload: OutlineFocusTarget): void {
    if (payload.kind === "relationship") {
      const relationship = diagramStore.relationships.find(
        (item) => String(item.id) === String(payload.id),
      );
      const tableId = payload.tableId ?? relationship?.startTableId;
      ui.focusIssue({
        relationshipId: String(payload.id),
        ...(tableId !== undefined ? { tableId: String(tableId) } : {}),
      });
      return;
    }
    if (payload.kind === "table") {
      ui.focusIssue({ tableId: String(payload.id) });
      return;
    }
    const collection =
      payload.kind === "area" ? diagramStore.areas : diagramStore.notes;
    const element = (collection ?? []).find(
      (item) => String(item.id) === String(payload.id),
    );
    if (payload.kind === "area") {
      ui.selectArea(String(payload.id));
    } else {
      ui.selectNote(String(payload.id));
    }
    if (element) {
      // The node has to land in the middle of the canvas, not under its top
      // left corner (the tree is a navigation, not a scrollbar).
      const width = (element as { width?: number }).width ?? 0;
      const height = (element as { height?: number }).height ?? 0;
      ui.centerOn(element.x + width / 2, element.y + height / 2);
    }
  }

  function assignTableToArea(payload: OutlineAreaAssignment): void {
    const area = (diagramStore.areas ?? []).find(
      (item) => String(item.id) === String(payload.areaId),
    );
    const table = diagramStore.tables.find(
      (item) => String(item.id) === String(payload.tableId),
    );
    if (!area || !table) return;
    const members = diagramStore.tables.filter(
      (item) =>
        String(item.id) !== String(payload.tableId) &&
        item.x >= area.x &&
        item.y >= area.y &&
        item.x < area.x + area.width &&
        item.y < area.y + area.height,
    );
    diagramStore.updateTable(payload.tableId, {
      x: area.x + 16,
      y: area.y + 48 + members.length * 48,
    });
  }

  return { focusOutlineNode, assignTableToArea };
}
