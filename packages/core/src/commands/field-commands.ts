import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field, FieldId } from "../models/field.ts";
import type { LogicalAttribute } from "../models/logical.ts";
import { removeFieldAtomic } from "../models/invariants.ts";
import type { Table, TableId } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";
import { createId } from "../utils/id.ts";

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
  private addedAttributeId: string | undefined;

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

    // INV-4 pairing: every physical field pairs with a logical attribute.
    if (table.logical) {
      const attribute: LogicalAttribute = {
        id: createId(),
        name: this.field.name,
        logicalType: { family: "string" },
        fieldId: this.field.id,
      };
      table.logical.attributes.push(attribute);
      this.addedAttributeId = attribute.id;
    }
  }

  undo(): void {
    const table = this.diagram.tables.find((t) => t.id === this.tableId);
    if (!table) return;

    const idx = table.fields.findIndex((f) => f.id === this.field.id);
    if (idx >= 0) {
      table.fields.splice(idx, 1);
    }
    if (table.logical && this.addedAttributeId !== undefined) {
      const attributeIdx = table.logical.attributes.findIndex(
        (a) => a.id === this.addedAttributeId,
      );
      if (attributeIdx >= 0) {
        table.logical.attributes.splice(attributeIdx, 1);
      }
      this.addedAttributeId = undefined;
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
  private previousTable: Table | undefined;
  private removedFieldName: string | undefined;

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
    return `Remove field ${this.removedFieldName ?? this.fieldId}`;
  }

  execute(): void {
    const tableIdx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (tableIdx < 0) return;

    const table = this.diagram.tables[tableIdx];
    const field = table.fields.find((f) => f.id === this.fieldId);
    if (!field) return;

    // INV-4 atomic delete: field, paired attribute and index/unique
    // constraint references go away in one step (spec section 3.5.2).
    this.previousTable = deepClone(table);
    this.removedFieldName = field.name;
    this.diagram.tables[tableIdx] = removeFieldAtomic(table, this.fieldId);
  }

  undo(): void {
    if (!this.previousTable) return;

    const tableIdx = this.diagram.tables.findIndex((t) => t.id === this.tableId);
    if (tableIdx < 0) return;

    this.diagram.tables[tableIdx] = this.previousTable;
    this.previousTable = undefined;
    this.removedFieldName = undefined;
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
