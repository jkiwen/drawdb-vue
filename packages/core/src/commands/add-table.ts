import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";

export interface AddTableCommandData {
  table: Table;
  index?: number;
}

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
