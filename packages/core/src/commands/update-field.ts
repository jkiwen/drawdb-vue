import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field, FieldId } from "../models/field.ts";
import type { TableId } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";

export class UpdateFieldCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly fieldId: FieldId;
  private readonly updates: Partial<Omit<Field, "id">>;
  private previousField: Field | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    fieldId: FieldId,
    updates: Partial<Omit<Field, "id">>,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.fieldId = fieldId;
    this.updates = updates;
  }

  get description(): string {
    return `Update field ${this.previousField?.name ?? this.fieldId}`;
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;
    const fieldIdx = table.fields.findIndex((f) => f.id === this.fieldId);
    if (fieldIdx < 0) return;

    this.previousField = deepClone(table.fields[fieldIdx]);
    table.fields[fieldIdx] = { ...table.fields[fieldIdx], ...this.updates };
  }

  undo(): void {
    if (!this.previousField) return;
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;
    const fieldIdx = table.fields.findIndex((f) => f.id === this.fieldId);
    if (fieldIdx < 0) return;

    table.fields[fieldIdx] = this.previousField;
  }
}
