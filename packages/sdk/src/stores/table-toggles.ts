import type { Diagram, TableId } from "@drawdb/core";
import { ToggleTableLockCommand, UpdateTableCommand } from "@drawdb/core";

/**
 * The toggles of a table: the lock and the details.
 *
 * They live in their own file so that the diagram store stays within the
 * allowed size. A locked table can still show its details: the lock stops
 * changes, not looking. The details themselves stay read-only while the
 * table is locked.
 */
export function tableToggles(
  diagram: Diagram,
  history: { execute(command: unknown): void },
  bump: () => void,
) {
  return {
    /** Locks a table, so that it cannot be moved any more. */
    toggleTableLock(id: TableId): void {
      history.execute(new ToggleTableLockCommand(diagram, id));
      bump();
    },

    /** Shows or hides the details of a table on the canvas. */
    toggleTableDetails(id: TableId): void {
      const table = diagram.tables.find((entry) => entry.id === id);
      if (!table) return;
      history.execute(
        new UpdateTableCommand(diagram, id, { details: table.details !== true }),
      );
      bump();
    },
  };
}
