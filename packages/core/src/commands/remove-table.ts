import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table, TableId } from "../models/table.ts";

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
