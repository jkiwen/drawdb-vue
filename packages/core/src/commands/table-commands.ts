import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table, TableId } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";

export interface AddTableCommandData {
  table: Table;
  index?: number;
}

/**
 * Adds a table to the diagram.
 */
export class AddTableCommand implements Command {
  private readonly diagram: Diagram;
  private readonly table: Table;
  private readonly index: number;

  constructor(
    diagram: Diagram,
    data: Table | AddTableCommandData,
  ) {
    this.diagram = diagram;
    if ("table" in data) {
      this.table = data.table;
      this.index = data.index ?? diagram.tables.length;
    } else {
      this.table = data;
      this.index = diagram.tables.length;
    }
  }

  get description(): string {
    return `Add table ${this.table.name}`;
  }

  execute(): void {
    const idx = Math.min(this.index, this.diagram.tables.length);
    this.diagram.tables.splice(idx, 0, this.table);
  }

  undo(): void {
    const idx = this.diagram.tables.findIndex((t) => t.id === this.table.id);
    if (idx >= 0) {
      this.diagram.tables.splice(idx, 1);
    }
  }
}

/**
 * Changes a table of the diagram.
 */
export class UpdateTableCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly updates: Partial<Omit<Table, "id">>;
  private previousTable: Table | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    updates: Partial<Omit<Table, "id">>,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.updates = updates;
  }

  get description(): string {
    return `Update table ${this.previousTable?.name ?? this.tableId}`;
  }

  execute(): void {
    const idx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (idx < 0) return;
    const target = this.diagram.tables[idx];
    this.previousTable = deepClone(target);
    this.diagram.tables[idx] = { ...target, ...this.updates };
  }

  undo(): void {
    if (!this.previousTable) return;
    const idx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (idx < 0) return;
    this.diagram.tables[idx] = this.previousTable;
  }
}

/**
 * Removes a table and the relationships that point at it.
 */
export class RemoveTableCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private removedTable: Table | undefined;
  private removedRelationships: Relationship[] = [];
  private removedIndex = -1;

  constructor(
    diagram: Diagram,
    tableId: TableId,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
  }

  get description(): string {
    return `Remove table ${this.removedTable?.name ?? this.tableId}`;
  }

  execute(): void {
    const tableIdx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (tableIdx < 0) return;

    this.removedIndex = tableIdx;
    this.removedTable = this.diagram.tables[tableIdx];

    this.removedRelationships = this.diagram.relationships.filter(
      (r) => r.startTableId === this.tableId || r.endTableId === this.tableId,
    );

    this.diagram.relationships = this.diagram.relationships.filter(
      (r) => r.startTableId !== this.tableId && r.endTableId !== this.tableId,
    );

    this.diagram.tables.splice(tableIdx, 1);
  }

  undo(): void {
    if (!this.removedTable || this.removedIndex < 0) return;

    this.diagram.tables.splice(this.removedIndex, 0, this.removedTable);

    for (const rel of this.removedRelationships) {
      this.diagram.relationships.push(rel);
    }

    this.removedRelationships = [];
  }
}

/**
 * Changes the width of a table. The height follows from the number of the
 * fields, so it is not part of the command.
 */
export class ResizeTableCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly width: number;
  private previousWidth: number | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    width: number,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.width = width;
  }

  get description(): string {
    return `Resize table ${this.tableId}`;
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    this.previousWidth = table.width;
    table.width = this.width;
  }

  undo(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    if (this.previousWidth === undefined) {
      delete table.width;
    } else {
      table.width = this.previousWidth;
    }
  }
}

/**
 * Locks a table or unlocks it. A locked table is not moved by the automatic
 * layout.
 */
export class ToggleTableLockCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private previousLocked: boolean | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
  }

  get description(): string {
    return `Toggle the lock of table ${this.tableId}`;
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    this.previousLocked = table.locked;
    table.locked = !table.locked;
  }

  undo(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    if (this.previousLocked === undefined) {
      delete table.locked;
    } else {
      table.locked = this.previousLocked;
    }
  }
}