import type { Area } from "@drawdb/core";
import type { DragApi } from "../../../composables/use-drag.ts";
import type { Point } from "../../../composables/use-viewport.ts";
import type { DiagramStore } from "../../../stores/diagram.ts";
import type { MoveRequest } from "../../../stores/element-actions.ts";
import type { useSelection } from "../../../composables/use-selection.ts";
import {
  areaHoldsElement,
  elementBounds,
  heldByLockedArea,
} from "../../../utils/elements.ts";
import type { CanvasActions } from "./use-canvas-actions.ts";

export interface CanvasDragOptions {
  diagram: DiagramStore;
  selection: ReturnType<typeof useSelection>;
  drag: DragApi;
  actions: CanvasActions;
  /** The point of the pointer, in the coordinates of the canvas. */
  point: (event: PointerEvent) => Point;
  /** The size of the grid the dragged elements snap to. */
  gridSize: () => number;
  /** Whether the dragged elements snap to the grid. */
  snapToGrid: () => boolean;
}

export interface CanvasDrag {
  /** Remembers where the elements of the drag that starts now are. */
  track(): void;
  /** Starts the drag of the tables when the user grabs a table. */
  onTableDragStart(payload: { id: string; event: PointerEvent }): void;
  /** Starts the drag of the areas when the user grabs an area. */
  onAreaDragStart(payload: {
    areaId: string | number;
    event: PointerEvent;
  }): void;
  /** Starts the drag of the notes when the user grabs a note. */
  onNoteDragStart(payload: {
    noteId: string | number;
    event: PointerEvent;
  }): void;
  /** Moves the dragged elements on the diagram, under the pointer. */
  preview(): void;
  /** Records the drag as a single undoable change. */
  commit(): void;
  /** Puts the dragged elements back where the drag started. */
  cancel(): void;
}

/** The positions the elements of a drag have once it moved by `delta`. */
function movedBy(
  origins: ReadonlyArray<MoveRequest>,
  kind: MoveRequest["kind"],
  delta: Point,
): Array<{ id: string; x: number; y: number }> {
  return origins
    .filter((origin) => origin.kind === kind)
    .map((origin) => ({
      id: origin.id,
      x: origin.x + delta.x,
      y: origin.y + delta.y,
    }));
}

/**
 * The elements that follow the pointer.
 *
 * A table and an area are drawn where the diagram says they are, so the drag
 * moves them on the diagram on every frame; otherwise they would only jump to
 * their new place when the button is released. The preview is not recorded in
 * the history: the composable keeps the position of the start, which is the one
 * the history has to return to, and the final position is written through a
 * command when the drag ends.
 */
export function useCanvasDrag(options: CanvasDragOptions): CanvasDrag {
  const { diagram, selection, drag, actions } = options;

  let origins: MoveRequest[] = [];

  function track(): void {
    origins = drag.dragState.ids.flatMap((id): MoveRequest[] => {
      const table = diagram.tableById(id);
      if (table) {
        return [{ kind: "table", id, x: table.x, y: table.y }];
      }
      const area = diagram.areas.find((item) => String(item.id) === id);
      if (area) {
        return [{ kind: "area", id, x: area.x, y: area.y }];
      }
      const note = diagram.notes.find((item) => String(item.id) === id);
      return note ? [{ kind: "note", id, x: note.x, y: note.y }] : [];
    });
  }

  function beginDragOf(point: Point, ids: string[]): void {
    drag.beginDrag(point, ids, {
      snapToGrid: options.snapToGrid(),
      gridSize: options.gridSize(),
    });
    track();
  }

  /**
   * The tables that the user grabbed follow the pointer, the other selected
   * ones with them, and a table that was not selected is selected first.
   */
  function onTableDragStart(payload: { id: string; event: PointerEvent }): void {
    const { id, event } = payload;
    if (!selection.isSelected(id)) {
      selection.select(id, { additive: event.shiftKey, kind: "table" });
    }
    if (!diagram.tableById(id)) {
      return;
    }
    beginDragOf(options.point(event), selection.selectedTables.value);
  }

  /**
   * The elements that the area holds, which travel with it.
   *
   * A table belongs to an area when the rectangle of the table and the
   * rectangle of the area overlap; an area that is drawn inside another area
   * belongs to it the same way. The relation is read from the places of the
   * elements, so that it needs no field in the model and stays true to the
   * drawing: a table that is dragged out of an area stops following it.
   *
   * The rule of the overlap, and not the rule of the corner, is the one that
   * answers the question of the user: a table that is drawn in an area travels
   * with it, although its corner may hang over the edge of the area.
   */
  function contentsOf(area: Area): string[] {
    const inside = (element: {
      x: number;
      y: number;
      width?: number;
      height?: number;
    }): boolean => areaHoldsElement(area, element);
    const ids = diagram.tables.filter(inside).map((table) => String(table.id));
    for (const other of diagram.areas) {
      if (String(other.id) !== String(area.id) && inside(other)) {
        ids.push(String(other.id));
      }
    }
    for (const note of diagram.notes) {
      if (inside(note)) {
        ids.push(String(note.id));
      }
    }
    return ids;
  }

  /** The areas of the drag, and everything they hold. */
  function idsOfAreaDrag(grabbed: string): string[] {
    const { selectedAreas } = selection;
    const areas = selectedAreas.value.includes(grabbed)
      ? selectedAreas.value
      : [grabbed];
    const ids = new Set<string>();
    for (const id of areas) {
      const area = diagram.areas.find((item) => String(item.id) === id);
      // A locked area stays where it is, so it does not join the drag.
      if (!area || area.locked === true) continue;
      ids.add(id);
      for (const held of contentsOf(area)) {
        ids.add(held);
      }
    }
    return [...ids];
  }

  /**
   * The area and the elements it holds follow the pointer, and an area that
   * was not selected is selected first. A locked area is selected by the
   * click but does not move.
   */
  function onAreaDragStart(payload: {
    areaId: string | number;
    event: PointerEvent;
  }): void {
    const id = String(payload.areaId);
    if (!selection.isSelected(id)) {
      selection.select(id, { additive: payload.event.shiftKey, kind: "area" });
    }
    const area = diagram.areas.find((item) => String(item.id) === id);
    if (!area || area.locked === true) {
      return;
    }
    beginDragOf(options.point(payload.event), idsOfAreaDrag(id));
  }

  function preview(): void {
    const { delta } = drag.dragState;
    diagram.previewTablePositions(movedBy(origins, "table", delta));
    diagram.previewAreaPositions(movedBy(origins, "area", delta));
    diagram.previewNotePositions(movedBy(origins, "note", delta));
  }

  function commit(): void {
    if (!drag.dragState.active) {
      return;
    }
    actions.commitDrag(origins);
    origins = [];
  }

  function cancel(): void {
    if (!drag.dragState.active) {
      return;
    }
    const still = { x: 0, y: 0 };
    diagram.previewTablePositions(movedBy(origins, "table", still));
    diagram.previewAreaPositions(movedBy(origins, "area", still));
    diagram.previewNotePositions(movedBy(origins, "note", still));
    drag.cancelDrag();
    origins = [];
  }

  /**
   * The notes follow the pointer, and a note that was not selected is selected
   * first. A note that the user locked does not move.
   */
  function onNoteDragStart(payload: {
    noteId: string | number;
    event: PointerEvent;
  }): void {
    const id = String(payload.noteId);
    const note = diagram.notes.find((item) => String(item.id) === id);
    // A locked note does not move, and neither does a note a locked area
    // holds: the lock of the area extends to the elements inside it.
    if (!note || note.locked || heldByLockedArea(diagram.areas, elementBounds(note))) {
      return;
    }
    if (!selection.isSelected(id)) {
      selection.select(id, { additive: payload.event.shiftKey, kind: "note" });
    }
    beginDragOf(options.point(payload.event), selection.selectedNotes.value);
  }

  return {
    track,
    onTableDragStart,
    onAreaDragStart,
    onNoteDragStart,
    preview,
    commit,
    cancel,
  };
}
