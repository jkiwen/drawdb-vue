import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { TableId } from "../models/table.ts";

export class AddFieldCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly field: Field;
  private readonly index: number | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    field: Field,
    index?: number,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.field = field;
    this.index = index;
  }

  get description(): string {
    return `Add field ${this.field.name}`;
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    const idx =
      this.index === undefined
        ? table.fields.length
        : Math.min(this.index, table.fields.length);
    table.fields.splice(idx, 0, this.field);
  }

  undo(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    const idx = table.fields.findIndex((f) => f.id === this.field.id);
    if (idx >= 0) {
      table.fields.splice(idx, 1);
    }
  }
}
