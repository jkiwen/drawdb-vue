import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field, FieldId } from "../models/field.ts";
import type { TableId } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";

/**
 * Adds a field to a table.
 *
 * Without an index the field is appended at the end of the table.
 */
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

/**
 * Changes a field of a table. The other fields are not touched.
 */
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

/**
 * Removes a field of a table.
 */
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

/**
 * Moves a field of a table to another place.
 */
export class MoveFieldCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly fromIndex: number;
  private readonly toIndex: number;
  private movedField: Field | undefined;

  constructor(
    diagram: Diagram,
    tableId: TableId,
    fromIndex: number,
    toIndex: number,
  ) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  get description(): string {
    return "Move field";
  }

  execute(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;
    if (this.fromIndex === this.toIndex) return;
    if (this.fromIndex < 0 || this.fromIndex >= table.fields.length) return;

    const [moved] = table.fields.splice(this.fromIndex, 1);
    if (!moved) return;
    this.movedField = moved;
    table.fields.splice(Math.min(this.toIndex, table.fields.length), 0, moved);
  }

  undo(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table || !this.movedField) return;

    const idx = table.fields.findIndex((f) => f.id === this.movedField?.id);
    if (idx < 0) return;

    const [moved] = table.fields.splice(idx, 1);
    table.fields.splice(Math.min(this.fromIndex, table.fields.length), 0, moved);
    this.movedField = undefined;
  }
}
