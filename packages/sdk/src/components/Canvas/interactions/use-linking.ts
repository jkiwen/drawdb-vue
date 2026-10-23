import { ref, type Ref } from "vue";
import {
  Constraint,
  createId,
  type Relationship,
  type RelationshipId,
  type Table,
} from "@drawdb/core";
import { useDiagramStore } from "../../../stores/diagram.ts";
import type { LinkingState, LinkingTarget } from "./interaction-state.ts";

export type { LinkingState, LinkingTarget };

export interface LinkingOptions {
  /**
   * The tables of the diagram. The composable needs them to find the primary
   * key of a target and to name the relationship. It reads the diagram store
   * when the option is missing.
   */
  tables?: () => Table[];
}

export interface LinkingApi {
  /** The link that is being drawn, or `null`. */
  linking: Ref<LinkingState | null>;
  /** Starts a link at a field of a table. */
  start(
    tableId: RelationshipId,
    fieldId: RelationshipId,
    point: { x: number; y: number },
  ): void;
  /** Moves the pointer of a link that is being drawn. */
  move(point: { x: number; y: number }): void;
  /**
   * Ends the link. Without a target the link is cancelled and nothing is
   * returned. The caller stores the relationship, the composable never
   * changes the diagram.
   */
  finish(target?: LinkingTarget): Relationship | null;
  /** Cancels the link that is being drawn. */
  cancel(): void;
}

/**
 * The state machine of a relationship that the user draws from a field to
 * another field.
 *
 * The composable holds the state of the link and builds the relationship, but
 * it never changes the diagram: the canvas stores the result with the
 * `AddRelationshipCommand` of the core.
 */
export function useLinking(options: LinkingOptions = {}): LinkingApi {
  const linking = ref<LinkingState | null>(null);

  function tables(): Table[] {
    if (options.tables) {
      return options.tables();
    }
    return useDiagramStore().tables;
  }

  function findTable(id: RelationshipId): Table | undefined {
    return tables().find((table) => String(table.id) === String(id));
  }

  function findField(table: Table | undefined, fieldId: RelationshipId) {
    return table?.fields.find((field) => String(field.id) === String(fieldId));
  }

  /** The first primary key of a table, the target of a link without a field. */
  function primaryKeyOf(table: Table | undefined): RelationshipId | undefined {
    return table?.fields.find((field) => field.primary)?.id;
  }

  function start(
    tableId: RelationshipId,
    fieldId: RelationshipId,
    point: { x: number; y: number },
  ): void {
    linking.value = {
      sourceTableId: tableId,
      sourceFieldId: fieldId,
      pointer: { x: point.x, y: point.y },
    };
  }

  function move(point: { x: number; y: number }): void {
    if (!linking.value) return;
    linking.value.pointer = { x: point.x, y: point.y };
  }

  function cancel(): void {
    linking.value = null;
  }

  function finish(target?: LinkingTarget): Relationship | null {
    const state = linking.value;
    if (!state) {
      return null;
    }

    // A link that ends on the canvas is not a relationship.
    if (!target) {
      cancel();
      return null;
    }

    const sourceTable = findTable(state.sourceTableId);
    const targetTable = findTable(target.tableId);
    if (!sourceTable || !targetTable) {
      cancel();
      return null;
    }

    const sourceField = findField(sourceTable, state.sourceFieldId);
    if (!sourceField) {
      cancel();
      return null;
    }

    const endFieldId = target.fieldId ?? primaryKeyOf(targetTable);
    if (endFieldId === undefined) {
      cancel();
      return null;
    }

    const relationship: Relationship = {
      id: createId(),
      name: `fk_${sourceTable.name}_${sourceField.name}_${targetTable.name}`,
      startTableId: sourceTable.id,
      startFieldId: sourceField.id,
      endTableId: targetTable.id,
      endFieldId,
      cardinality: sourceField.unique ? "one_to_one" : "many_to_one",
      updateConstraint: Constraint.NONE,
      deleteConstraint: Constraint.NONE,
    };

    cancel();
    return relationship;
  }

  return { linking, start, move, finish, cancel };
}
