import {
  AutoArrangeCommand,
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  autoArrange,
  flowLayout,
  gridLayout,
} from "@drawdb/core";
import type { Diagram, Table, TableId } from "@drawdb/core";
import {
  alignBoxes,
  distributeBoxes,
  type AlignBox,
  type AlignMode,
  type DistributeAxis,
} from "../composables/align-geometry.ts";

/**
 * The layout and alignment commands of the toolbar (design 6.3 and 6.5).
 *
 * Every action computes the final coordinate of each table and then runs one
 * AutoArrangeCommand over the whole diagram, so a layout or an alignment is
 * a single undo step even when it moved twenty tables. A locked table is
 * never part of the target set (Q6).
 */

const DEFAULT_TABLE_WIDTH = 220;

/** The box of a table, from the size the canvas draws it with. */
export function tableBoxes(tables: readonly Table[]): AlignBox[] {
  return tables.map((table) => ({
    id: String(table.id),
    x: table.x ?? 0,
    y: table.y ?? 0,
    width: table.width ?? DEFAULT_TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT * (table.fields?.length ?? 0),
  }));
}

export function arrangeActions(
  diagram: Diagram,
  history: { execute(command: unknown): void },
  bump: () => void,
) {
  /**
   * Moves the named tables to the computed boxes in one command; the tables
   * the boxes do not name keep their coordinates.
   */
  function run(boxes: readonly AlignBox[]): boolean {
    if (!boxes.length) return false;
    const moved = new Map(boxes.map((box) => [box.id, box]));
    const positions = diagram.tables.map((table) => {
      const box = moved.get(String(table.id));
      return box ? { x: box.x, y: box.y } : { x: table.x ?? 0, y: table.y ?? 0 };
    });
    const previous = diagram.tables.map((table) => ({
      x: table.x ?? 0,
      y: table.y ?? 0,
    }));
    history.execute(new AutoArrangeCommand(diagram, positions, previous));
    bump();
    return true;
  }

  /** The tables an action works on: the selection, or every unlocked table. */
  function targets(selectedIds: readonly TableId[]): Table[] {
    const tables = diagram.tables;
    if (selectedIds.length === 0) return tables.filter((table) => table.locked !== true);
    const wanted = new Set(selectedIds.map(String));
    return tables.filter(
      (table) => wanted.has(String(table.id)) && table.locked !== true,
    );
  }

  /** The whole-diagram automatic layout of the header button. */
  function arrangeAll(): void {
    const positions = autoArrange(diagram.tables, diagram.relationships);
    const previous = diagram.tables.map((table) => ({ x: table.x, y: table.y }));
    history.execute(new AutoArrangeCommand(diagram, positions, previous));
    bump();
  }

  /** Runs the block layout the toolbar asked for on the target tables. */
  function layoutTables(
    kind: "grid" | "flow" | "auto",
    selectedIds: readonly TableId[],
  ): boolean {
    const target = targets(selectedIds);
    if (target.length === 0) return false;

    let positions: { x: number; y: number }[];
    if (kind === "auto") {
      const ids = new Set(target.map((table) => String(table.id)));
      const relationships = (diagram.relationships ?? []).filter(
        (relationship) =>
          ids.has(String(relationship.startTableId)) &&
          ids.has(String(relationship.endTableId)),
      );
      positions = autoArrange(target, relationships);
    } else if (kind === "grid") {
      positions = gridLayout(target);
    } else {
      positions = flowLayout(target);
    }

    return run(
      tableBoxes(target).map((box, index) => ({
        ...box,
        x: positions[index]?.x ?? box.x,
        y: positions[index]?.y ?? box.y,
      })),
    );
  }

  /** The tables the selection names, without the locked ones (Q6). */
  function selected(selectedIds: readonly TableId[]): Table[] {
    const wanted = new Set(selectedIds.map(String));
    return diagram.tables.filter(
      (table) => wanted.has(String(table.id)) && table.locked !== true,
    );
  }

  /** Aligns the target tables to one edge or centre line of their box. */
  function alignTables(mode: AlignMode, selectedIds: readonly TableId[]): boolean {
    // Alignment only ever works on the selection: stacking the whole canvas
    // on one edge is not an action anyone means.
    const target = selected(selectedIds);
    if (target.length < 2) return false;
    const boxes = tableBoxes(target);
    const moved = new Map(alignBoxes(boxes, mode).map((box) => [box.id, box]));
    return run(boxes.map((box) => ({ ...box, ...moved.get(box.id)! })));
  }

  /** Spreads the target tables so the gaps between them are equal. */
  function distributeTables(
    axis: DistributeAxis,
    selectedIds: readonly TableId[],
  ): boolean {
    const target = selected(selectedIds);
    if (target.length < 3) return false;
    const boxes = tableBoxes(target);
    const moved = new Map(distributeBoxes(boxes, axis).map((box) => [box.id, box]));
    return run(boxes.map((box) => ({ ...box, ...moved.get(box.id)! })));
  }

  return {
    autoArrange: arrangeAll,
    layoutTables,
    alignTables,
    distributeTables,
    targetTables: targets,
    selectedTables: selected,
  };
}
