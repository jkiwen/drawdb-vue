import { useDiagramStore } from "./diagram.ts";
import { useSelectionStore } from "./selection.ts";

/** The shape of the object a problem of the diagram is about. */
export interface FocusIssueTarget {
  tableId?: string;
  fieldId?: string;
  relationshipId?: string;
  viewId?: string;
}

/**
 * Selects the object a problem of the diagram is about and scrolls the
 * canvas to it. A relationship is selected when the issue carries one, a
 * field when it carries a field, and the table otherwise.
 *
 * It lives next to the selection store because it needs the diagram as
 * well: the scroll position comes from the coordinates of the table the
 * issue points at. The scroll position is written through the store, and
 * the caller reads it back from the store, so that a component holding the
 * same selection store always sees the move.
 */
export function useFocusIssue(): (issue: FocusIssueTarget) => void {
  const diagram = useDiagramStore();
  const selection = useSelectionStore();

  return function focusIssue(issue: FocusIssueTarget): void {
    if (issue.relationshipId) {
      selection.selectRelationship(issue.relationshipId);
    } else if (issue.tableId && issue.fieldId) {
      selection.selectField(issue.tableId, issue.fieldId);
    } else if (issue.tableId) {
      selection.selectTable(issue.tableId);
    } else if (issue.viewId) {
      selection.clearSelection();
    }
    if (issue.tableId) {
      const table = diagram.tables.find(
        (item) => String(item.id) === String(issue.tableId),
      );
      if (table) {
        selection.scrollX = table.x;
        selection.scrollY = table.y;
      }
    }
  };
}
