import type { DiagramStore } from "../../../stores/diagram.ts";
import type { MoveRequest } from "../../../stores/element-actions.ts";
import type { SelectionApi } from "../../../composables/use-selection.ts";
import type { DragApi } from "../../../composables/use-drag.ts";
import { tableWidth } from "../geometry.ts";
import type { LinkingApi } from "./use-linking.ts";
import type { ResizeApi } from "./use-resize.ts";
import type { SelectionBoxApi, SelectionRect } from "./use-selection-box.ts";
import type { ContextMenuApi } from "./use-context-menu.ts";
import type { ContextMenuTarget } from "./interaction-state.ts";
import type { CanvasCommands } from "./use-canvas-commands.ts";
import { resolveLinkTarget } from "./link-target.ts";

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
  commitDrag(origins: ReadonlyArray<MoveRequest>): void;
  /** Selects the tables the rectangle touches. */
  commitSelection(rect: SelectionRect | null): void;
  /** Writes the size of a table or of an area into the diagram. */
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

  /**
   * Turns the drag that the canvas previewed into one undoable change.
   *
   * The elements already sit at their final position, because the preview moved
   * them on every frame; they are put back where the drag started and moved
   * again through one command, so that the history records the positions to
   * return to and takes the drag of an area with the tables in it back at once.
   */
  function commitDrag(origins: ReadonlyArray<MoveRequest>): void {
    const result = drag.endDrag();
    if (!result) {
      return;
    }
    const { delta } = result;
    if (delta.x === 0 && delta.y === 0) {
      // A click on the element is not a move, so it leaves no entry to undo.
      return;
    }
    const moves: MoveRequest[] = [];
    for (const origin of origins) {
      const move: MoveRequest = {
        kind: origin.kind,
        id: origin.id,
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      };
      if (origin.kind === "area") {
        if (!diagram.areas.some((item) => String(item.id) === origin.id)) {
          continue;
        }
        diagram.previewAreaPositions([origin]);
        moves.push(move);
        continue;
      }
      if (origin.kind === "note") {
        if (!diagram.notes.some((item) => String(item.id) === origin.id)) {
          continue;
        }
        diagram.previewNotePositions([origin]);
        moves.push(move);
        continue;
      }
      if (!diagram.tableById(origin.id)) {
        continue;
      }
      diagram.previewTablePositions([origin]);
      moves.push(move);
    }
    diagram.moveElements(moves);
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

  /**
   * Writes the size the user dragged into the diagram.
   *
   * The height of a table follows its fields, so only the width of a table is
   * stored; the height of an area is its own, so both sides are stored. A
   * handle that was pressed without being dragged writes nothing: an entry of
   * the history that changes no size would make the user undo twice to get the
   * size of before the drag back.
   */
  function commitResize(): void {
    const state = resize.resizing.value;
    resize.end();
    if (!state) {
      return;
    }
    if (state.kind === "area") {
      const area = diagram.areas.find((item) => String(item.id) === String(state.id));
      if (!area || (area.width === state.width && area.height === state.height)) {
        return;
      }
      diagram.updateArea(state.id, {
        width: state.width,
        height: state.height,
      });
      return;
    }
    if (state.kind === "note") {
      const note = diagram.notes.find((item) => String(item.id) === String(state.id));
      if (!note || (note.width === state.width && note.height === state.height)) {
        return;
      }
      diagram.updateNote(state.id, {
        width: state.width,
        height: state.height,
      });
      return;
    }
    const table = diagram.tableById(state.id);
    if (!table || tableWidth(table) === state.width) {
      return;
    }
    diagram.updateTable(state.id, { width: state.width });
  }

  function commitLink(event: PointerEvent): void {
    const target = event.target as Element | null;
    // The link can end on a field or on a table. A link that ends on a table
    // is linked to the primary key of that table.
    const link = resolveLinkTarget(target);
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
