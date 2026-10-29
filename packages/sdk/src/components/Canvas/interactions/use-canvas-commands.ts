import { AutoArrangeCommand, ToggleTableLockCommand, autoArrange } from "@drawdb/core";
import { useDiagramStore } from "../../../stores/diagram.ts";
import { useHistoryStore } from "../../../stores/history.ts";
import { SetPrimaryKeyCommand } from "../../../stores/key-actions.ts";
import { createTable, uniqueTableName } from "../../../utils/elements.ts";
import type { ContextMenuTarget } from "./interaction-state.ts";

export interface CanvasCommands {
  /** Runs a command of the menu of the canvas. */
  run(key: string, target: ContextMenuTarget): boolean;
}

/**
 * The commands of the menu of the canvas.
 *
 * Every change goes through the history store, so that the user can undo it.
 */
export function useCanvasCommands(): CanvasCommands {
  const diagram = useDiagramStore();
  const history = useHistoryStore();

  function run(key: string, target: ContextMenuTarget): boolean {
    switch (key) {
      case "canvas:add-table": {
        const name = uniqueTableName(diagram.tables);
        diagram.addTable(createTable(name, { x: 100, y: 100 }));
        return true;
      }

      case "canvas:auto-arrange": {
        const positions = autoArrange(diagram.tables, diagram.relationships);
        const previous = diagram.tables.map((table) => ({
          x: table.x,
          y: table.y,
        }));
        history.execute(
          new AutoArrangeCommand(diagram.diagram, positions, previous),
        );
        return true;
      }

      case "table:toggle-lock": {
        if (target.tableId === undefined) {
          return false;
        }
        const table = diagram.tableById(target.tableId);
        if (!table) {
          return false;
        }
        history.execute(new ToggleTableLockCommand(diagram.diagram, table.id));
        return true;
      }

      case "table:delete": {
        if (target.tableId === undefined) {
          return false;
        }
        const table = diagram.tableById(target.tableId);
        if (!table) {
          return false;
        }
        diagram.removeTable(table.id);
        return true;
      }

      case "field:primary":
      case "field:not-null":
      case "field:unique": {
        if (target.tableId === undefined || target.fieldId === undefined) {
          return false;
        }
        const field = diagram.fieldById(target.tableId, target.fieldId);
        if (!field) {
          return false;
        }
        if (key === "field:primary") {
          const table = diagram.tableById(target.tableId);
          if (!table) {
            return false;
          }
          const primaryColumns = table.primaryKey?.columns ?? [];
          const isPrimary = primaryColumns.some(
            (column) => String(column.fieldId) === String(target.fieldId),
          );
          const columns = isPrimary
            ? primaryColumns.filter(
                (column) => String(column.fieldId) !== String(target.fieldId),
              )
            : [...primaryColumns, { fieldId: target.fieldId }];
          history.execute(new SetPrimaryKeyCommand(diagram.diagram, table.id, columns));
        }
        if (key === "field:not-null") {
          diagram.updateField(target.tableId, target.fieldId, {
            notNull: !field.notNull,
          });
        }
        if (key === "field:unique") {
          diagram.updateField(target.tableId, target.fieldId, {
            unique: !field.unique,
          });
        }
        return true;
      }

      case "field:delete": {
        if (target.tableId === undefined || target.fieldId === undefined) {
          return false;
        }
        const field = diagram.fieldById(target.tableId, target.fieldId);
        if (!field) {
          return false;
        }
        diagram.removeField(target.tableId, target.fieldId);
        return true;
      }

      default:
        return false;
    }
  }

  return { run };
}
