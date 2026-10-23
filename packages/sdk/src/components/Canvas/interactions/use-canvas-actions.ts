import type { DiagramStore } from "../../../stores/diagram.ts";
import type { SelectionApi } from "../../../composables/use-selection.ts";
import type { DragApi } from "../../../composables/use-drag.ts";
import type { LinkingApi } from "./use-linking.ts";
import type { ResizeApi } from "./use-resize.ts";
import type { SelectionBoxApi, SelectionRect } from "./use-selection-box.ts";
import type { ContextMenuApi } from "./use-context-menu.ts";
import type { ContextMenuTarget } from "./interaction-state.ts";
import type { CanvasCommands } from "./use-canvas-commands.ts";

export interface CanvasActionsOptions {
  diagram: DiagramStore;
  selection: SelectionApi;
  drag: DragApi;
  selectionBox: SelectionBoxApi;
  resize: ResizeApi;
  linking: LinkingApi;
  contextMenu: ContextMenuApi;
  commands: CanvasCommands;
}

export interface CanvasActions {
  /** Writes the result of a drag into the diagram. */
  commitDrag(): void;
  /** Selects the tables the rectangle touches. */
  commitSelection(rect: SelectionRect | null): void;
  /** Writes the size of a table into the diagram. */
  commitResize(): void;
  /** Creates the relationship the user drew. */
  commitLink(event: PointerEvent): void;
  /** The object the menu of the right button was opened on. */
  contextTargetOf(event: MouseEvent): ContextMenuTarget;
  /** Runs a command of the menu of the canvas. */
  runMenuCommand(key: string): boolean;
}

/**
 * The changes that the user makes on the canvas.
 *
 * Every action writes into the diagram through the history store, so that the
 * user can undo it.
 */
export function useCanvasActions(options: CanvasActionsOptions): CanvasActions {
  const { diagram, selection, drag, selectionBox, resize, linking, commands } =
    options;

  function commitDrag(): void {
    const result = drag.endDrag();
    if (!result) {
      return;
    }
    for (const id of result.ids) {
      const table = diagram.tableById(id);
      if (table) {
        diagram.updateTable(id, {
          x: table.x + result.delta.x,
          y: table.y + result.delta.y,
        });
      }
    }
  }

  function commitSelection(rect: SelectionRect | null): void {
    selectionBox.end();
    if (!rect) {
      return;
    }
    const ids = selectionBox.idsIn(rect, diagram.tables).map(String);
    if (ids.length) {
      selection.selectMany(ids, { kind: "table" });
    }
  }

  function commitResize(): void {
    const state = resize.resizing.value;
    resize.end();
    if (state) {
      diagram.updateTable(state.tableId, { width: state.width });
    }
  }

  function commitLink(event: PointerEvent): void {
    const target = event.target as Element | null;
    const handle =
      target && typeof target.closest === "function"
        ? target.closest("[data-field-handle]")
        : null;
    const link = handle
      ? {
          tableId: handle.getAttribute("data-table-id") ?? "",
          fieldId: handle.getAttribute("data-field-id") ?? undefined,
        }
      : undefined;
    const relationship = linking.finish(link);
    if (relationship) {
      diagram.addRelationship(relationship);
    }
  }

  function contextTargetOf(event: MouseEvent): ContextMenuTarget {
    const target = event.target as Element | null;
    const element =
      target && typeof target.closest === "function" ? target : null;

    const field = element?.closest("[data-field-id]");
    if (field) {
      return {
        kind: "field",
        tableId: field.getAttribute("data-table-id") ?? undefined,
        fieldId: field.getAttribute("data-field-id") ?? undefined,
      };
    }

    const table = element?.closest("[data-table-id]");
    if (table) {
      return {
        kind: "table",
        tableId: table.getAttribute("data-table-id") ?? undefined,
      };
    }

    return { kind: "canvas" };
  }

  function runMenuCommand(key: string): boolean {
    const target = options.contextMenu.menu.value?.target ?? { kind: "canvas" };
    return commands.run(key, target);
  }

  return {
    commitDrag,
    commitSelection,
    commitResize,
    commitLink,
    contextTargetOf,
    runMenuCommand,
  };
}
