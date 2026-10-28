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
 * The scroll position is written through the selection store and, when the
 * caller passes `scrollTo`, through that callback as well: the canvas reads
 * its viewport from the ui store, so the editor passes a writer for it and
 * the two stay in step.
 */
export function useFocusIssue(
  scrollTo?: (x: number, y: number) => void,
): (issue: FocusIssueTarget) => void {
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
        scrollTo?.(table.x, table.y);
      }
    }
  };
}
