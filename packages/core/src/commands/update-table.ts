import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table, TableId } from "../models/table.ts";

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
    this.previousTable = structuredClone(target);
    this.diagram.tables[idx] = { ...target, ...this.updates };
  }

  undo(): void {
    if (!this.previousTable) return;
    const idx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (idx < 0) return;
    this.diagram.tables[idx] = this.previousTable;
  }
}
