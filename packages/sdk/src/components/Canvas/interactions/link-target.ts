import type { LinkingTarget } from "./interaction-state.ts";

/**
 * The place where a link that the user draws ends.
 *
 * A link can end on a field of a table or on a table as a whole. A link that
 * ends on a table has no field, and the canvas links it to the primary key of
 * that table.
 */
export function isLinkingTarget(value: unknown): value is LinkingTarget {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { tableId?: unknown; fieldId?: unknown };
  if (candidate.tableId === undefined || candidate.tableId === null) {
    return false;
  }
  return (
    typeof candidate.tableId === "string" ||
    typeof candidate.tableId === "number"
  );
}

/**
 * Resolves the place where a link ends from the element under the pointer.
 *
 * The resolution walks the element and its ancestors, from the closest one to
 * the farthest one, and stops at the first element that carries an id:
 *
 * 1. The handle of a field (`[data-field-handle]`) — the link ends on that
 *    field.
 * 2. The row of a field (`[data-field-id]`) — the link ends on that field.
 * 3. The table (`[data-table-id]`) — the link ends on the table, and the
 *    canvas links it to the primary key of the table.
 *
 * The element without any of those attributes ends the link nowhere, so the
 * link is cancelled.
 */
export function resolveLinkTarget(
  element: Element | null | undefined,
): LinkingTarget | undefined {
  if (!element || typeof element.closest !== "function") {
    return undefined;
  }

  const handle = element.closest("[data-field-handle]");
  if (handle) {
    const tableId = handle.getAttribute("data-table-id");
    if (tableId) {
      return {
        tableId,
        fieldId: handle.getAttribute("data-field-id") ?? undefined,
      };
    }
  }

  // The row of a field carries the id of the table as well, so the field is
  // looked up before the table.
  const field = element.closest("[data-field-id]");
  if (field) {
    const tableId = field.getAttribute("data-table-id");
    if (tableId) {
      return {
        tableId,
        fieldId: field.getAttribute("data-field-id") ?? undefined,
      };
    }
  }

  const table = element.closest("[data-table-id]");
  if (table) {
    const tableId = table.getAttribute("data-table-id");
    if (tableId) {
      // No field: the link ends on the table and the canvas links it to the
      // primary key of the table.
      return { tableId };
    }
  }

  return undefined;
}
