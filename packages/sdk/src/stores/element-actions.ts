import {
  AddEntityCommand,
  CompositeCommand,
  RemoveEntityCommand,
  UpdateEntityCommand,
  UpdateTableCommand,
} from "@drawdb/core";
import type {
  Area,
  Command,
  Diagram,
  DiagramEntityCollection,
  Note,
} from "@drawdb/core";

/** The collections of a diagram that can hold its areas. */
export type AreaCollection = Extract<DiagramEntityCollection, "areas" | "subjectAreas">;

/**
 * An element that the canvas drags, and the place the drag puts it at.
 *
 * A table, an area and a note are moved the same way but not through the same
 * command, so the kind of the element travels with the position.
 */
export interface MoveRequest {
  kind: "table" | "area" | "note";
  id: string;
  x: number;
  y: number;
}

export interface ElementActions {
  /** Adds an area where the diagram keeps its areas. */
  addArea(area: Area): void;
  /** Changes the properties of an area, the size it was resized to included. */
  updateArea(id: string | number, updates: Partial<Omit<Area, "id">>): void;
  /**
   * Moves areas without recording the change, the live preview of a drag.
   *
   * The caller keeps the position of the start and commits the final one with
   * `moveElements`, so the preview is never the last word on the diagram.
   */
  previewAreaPositions(
    moves: ReadonlyArray<{ id: string | number; x: number; y: number }>,
  ): void;
  /** Removes an area. */
  removeArea(id: string | number | undefined): void;
  /**
   * Changes the properties of a note, the size it was resized to included.
   */
  updateNote(id: string | number, updates: Partial<Omit<Note, "id">>): void;
  /**
   * Moves notes without recording the change, the live preview of a drag.
   */
  previewNotePositions(
    moves: ReadonlyArray<{ id: string | number; x: number; y: number }>,
  ): void;
  /**
   * Moves tables, areas and notes as one entry of the history.
   *
   * The undo takes the drag of an area and the tables it carries inside it back
   * at once, which is what makes the drag look like a single gesture.
   */
  moveElements(moves: ReadonlyArray<MoveRequest>): void;
}

/**
 * The collection of a diagram that holds its areas.
 *
 * A diagram that the application created keeps its areas in `subjectAreas`,
 * because the empty diagram of the core leaves `areas` undefined; a diagram
 * that the canvas edited keeps them in `areas`. The store reads
 * `areas ?? subjectAreas`, so a write has to land exactly where the read finds
 * the areas: a write into the other collection would either disappear or, when
 * it makes `areas` exist, hide the areas the diagram already had.
 */
export function areaCollection(diagram: Diagram): AreaCollection {
  return diagram.areas ? "areas" : "subjectAreas";
}

/** The areas of a diagram, whichever of the two collections holds them. */
function areasOf(diagram: Diagram): Area[] {
  return diagram[areaCollection(diagram)] ?? [];
}

/**
 * The actions of the elements the canvas draws on its own: the areas, and the
 * drags that move several elements at once.
 *
 * The actions are built the way the side panel builds the actions of its own
 * entity types: a factory that gets the diagram of the store, so that the store
 * stays the only place that knows about the history of the diagram.
 */
export function elementActions(
  diagram: Diagram,
  history: { execute(command: unknown): void },
  bump: () => void,
): ElementActions {
  function addArea(area: Area): void {
    history.execute(new AddEntityCommand(diagram, areaCollection(diagram), area));
    bump();
  }

  function updateArea(id: string | number, updates: Partial<Omit<Area, "id">>): void {
    history.execute(
      new UpdateEntityCommand(
        diagram,
        areaCollection(diagram),
        id,
        updates as Record<string, unknown>,
      ),
    );
    bump();
  }

  function previewAreaPositions(
    moves: ReadonlyArray<{ id: string | number; x: number; y: number }>,
  ): void {
    const areas = areasOf(diagram);
    for (const move of moves) {
      const area = areas.find((item) => String(item.id) === String(move.id));
      if (!area) continue;
      area.x = move.x;
      area.y = move.y;
    }
  }

  function removeArea(id: string | number | undefined): void {
    history.execute(new RemoveEntityCommand(diagram, areaCollection(diagram), id));
    bump();
  }

  function updateNote(
    id: string | number,
    updates: Partial<Omit<Note, "id">>,
  ): void {
    history.execute(
      new UpdateEntityCommand(diagram, "notes", id, updates as Record<string, unknown>),
    );
    bump();
  }

  function previewNotePositions(
    moves: ReadonlyArray<{ id: string | number; x: number; y: number }>,
  ): void {
    for (const move of moves) {
      const note = diagram.notes.find((item) => String(item.id) === String(move.id));
      if (!note) continue;
      if (note.locked) continue;
      note.x = move.x;
      note.y = move.y;
    }
  }

  function commandOf(move: MoveRequest): Command | undefined {
    if (move.kind === "table") {
      const table = diagram.tables.find((item) => String(item.id) === move.id);
      if (!table || table.locked) {
        return undefined;
      }
      return new UpdateTableCommand(diagram, move.id, { x: move.x, y: move.y });
    }
    if (move.kind === "note") {
      const note = diagram.notes.find((item) => String(item.id) === move.id);
      if (!note || note.locked) {
        return undefined;
      }
      return new UpdateEntityCommand(diagram, "notes", move.id, {
        x: move.x,
        y: move.y,
      });
    }
    if (!areasOf(diagram).some((area) => String(area.id) === move.id)) {
      return undefined;
    }
    return new UpdateEntityCommand(diagram, areaCollection(diagram), move.id, {
      x: move.x,
      y: move.y,
    });
  }

  function moveElements(moves: ReadonlyArray<MoveRequest>): void {
    const commands = moves.flatMap((move): Command[] => {
      const command = commandOf(move);
      return command ? [command] : [];
    });
    if (commands.length === 0) {
      return;
    }
    const move = commands.length === 1 ? commands[0]! : new CompositeCommand(
      "Move the elements of the diagram",
      commands,
    );
    history.execute(move);
    bump();
  }

  return {
    addArea,
    updateArea,
    previewAreaPositions,
    removeArea,
    updateNote,
    previewNotePositions,
    moveElements,
  };
}
