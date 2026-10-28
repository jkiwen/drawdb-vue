import { CompositeCommand, UpdateTableCommand } from "@drawdb/core";
import type {
  Command,
  Diagram,
  LogicalRelationship,
  RelationshipId,
  Table,
  TableId,
} from "@drawdb/core";
import { elementBounds, heldByLockedArea } from "../utils/elements.ts";
import { areaCollection } from "./element-actions.ts";

/**
 * The writes of the edit panel that the diagram store does not cover yet:
 * the logical side of a relationship, and the atomic batch update of a
 * multi selection (Q12). They live in their own file, so that the store of
 * the diagram stays a file of the size the repository allows.
 */

/**
 * Changes the logical relationship that shares its id with a physical
 * relationship (INV-6). The first write creates the logical entry when the
 * diagram has none yet, so the panel never has to special-case a missing
 * counterpart.
 */
class UpdateLogicalRelationshipCommand implements Command {
  private readonly diagram: Diagram;
  private readonly id: RelationshipId;
  private readonly updates: Partial<Omit<LogicalRelationship, "id">>;
  private previous: LogicalRelationship | undefined;
  private created = false;

  constructor(
    diagram: Diagram,
    id: RelationshipId,
    updates: Partial<Omit<LogicalRelationship, "id">>,
  ) {
    this.diagram = diagram;
    this.id = id;
    this.updates = updates;
  }

  get description(): string {
    return `Update logical relationship ${String(this.id)}`;
  }

  private list(): LogicalRelationship[] {
    this.diagram.logicalRelationships ??= [];
    return this.diagram.logicalRelationships;
  }

  execute(): void {
    const list = this.list();
    const idx = list.findIndex((item) => String(item.id) === String(this.id));
    if (idx < 0) {
      list.push({ id: this.id, ...this.updates });
      this.created = true;
      return;
    }
    this.previous = { ...list[idx]! };
    list[idx] = { ...list[idx]!, ...this.updates };
  }

  undo(): void {
    const list = this.diagram.logicalRelationships ?? [];
    const idx = list.findIndex((item) => String(item.id) === String(this.id));
    if (idx < 0) return;
    if (this.created) {
      list.splice(idx, 1);
      this.created = false;
      return;
    }
    if (this.previous) {
      list[idx] = this.previous;
      this.previous = undefined;
    }
  }
}

/** The shared properties a multi selection of tables can edit (design 4.7). */
export interface TableBatchPatch {
  /** The physical comment; an empty string clears it. */
  comment?: string;
  /** The logical description; an empty string clears it. */
  logicalDescription?: string;
  /** The table colour; an empty string clears it. */
  color?: string;
  locked?: boolean;
  /** Whether the fields of the table show on the canvas. */
  details?: boolean;
}

export function editPanelActions(
  diagram: Diagram,
  history: { execute(command: unknown): void },
  bump: () => void,
) {
  function updateLogicalRelationship(
    id: RelationshipId,
    updates: Partial<Omit<LogicalRelationship, "id">>,
  ): void {
    history.execute(new UpdateLogicalRelationshipCommand(diagram, id, updates));
    bump();
  }

  /**
   * The same lock rule as the `isLocked` of the store: a user lock or a
   * locked area that holds the table. A missing table counts as locked, so
   * a stale selection cannot half-apply.
   */
  function isTableReadonly(tableId: TableId): boolean {
    const table = diagram.tables.find(
      (item) => String(item.id) === String(tableId),
    );
    if (!table) return true;
    const areas = diagram[areaCollection(diagram)] ?? [];
    return (
      table.locked === true || heldByLockedArea(areas, elementBounds(table))
    );
  }

  /**
   * Applies one patch to every table of a multi selection as a single
   * entry of the history (design section 4.7). Q12 atomicity: when any
   * table of the selection refuses the change, nothing is applied at all
   * and the caller learns it from the return value.
   */
  function applyTableBatch(
    tables: readonly Table[],
    patch: TableBatchPatch,
  ): boolean {
    if (tables.length === 0) return false;
    if (tables.some((table) => isTableReadonly(table.id))) return false;

    const commands = tables.map((table) => {
      const updates: Partial<Omit<Table, "id">> = {};
      if (patch.comment !== undefined) {
        updates.comment = patch.comment === "" ? undefined : patch.comment;
      }
      if (patch.logicalDescription !== undefined) {
        updates.logical = {
          ...table.logical,
          description:
            patch.logicalDescription === "" ? undefined : patch.logicalDescription,
        };
      }
      if (patch.color !== undefined) {
        updates.color = patch.color === "" ? undefined : patch.color;
      }
      if (patch.locked !== undefined) updates.locked = patch.locked;
      if (patch.details !== undefined) updates.details = patch.details;
      return new UpdateTableCommand(diagram, table.id, updates);
    });
    history.execute(new CompositeCommand("Update the selected tables", commands));
    bump();
    return true;
  }

  return { updateLogicalRelationship, applyTableBatch };
}
