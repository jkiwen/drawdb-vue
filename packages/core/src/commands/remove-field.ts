import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field, FieldId } from "../models/field.ts";
import type { TableId } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";

export class RemoveFieldCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly fieldId: FieldId;
  private removedField: Field | undefined;
  private removedIndex = -1;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    fieldId: FieldId,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.fieldId = fieldId;
  }

  get description(): string {
    return `Remove field ${this.removedField?.name ?? this.fieldId}`;
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    const idx = table.fields.findIndex((f) => f.id === this.fieldId);
    if (idx < 0) return;

    this.removedIndex = idx;
    this.removedField = deepClone(table.fields[idx]);
    table.fields.splice(idx, 1);
  }

  undo(): void {
    if (!this.removedField || this.removedIndex < 0) return;

    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    const idx = Math.min(this.removedIndex, table.fields.length);
    table.fields.splice(idx, 0, this.removedField);
    this.removedField = undefined;
    this.removedIndex = -1;
  }
}
