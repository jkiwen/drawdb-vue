import {
  AddEntityCommand,
  AddFieldCommand,
  AddRelationshipCommand,
  AddRelationshipsCommand,
  AddTableCommand,
  AutoArrangeCommand,
  MoveFieldCommand,
  RemoveEntityCommand,
  RemoveFieldCommand,
  RemoveRelationshipCommand,
  RemoveTableCommand,
  ResizeTableCommand,
  ToggleTableLockCommand,
  UpdateFieldCommand,
  UpdateRelationshipCommand,
  UpdateTableCommand,
  UpdateDiagramCommand,
  autoArrange,
  createEmptyDiagram,
} from "@drawdb/core";
import type {
  Diagram,
  DiagramEntityInput,
  DiagramEntityCollection,
  DiagramProperties,
  Field,
  FieldId,
  Relationship,
  RelationshipId,
  Table,
  TableId,
} from "@drawdb/core";
import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { useHistoryStore } from "./history.ts";
import { elementActions } from "./element-actions.ts";
import { sidePanelActions } from "./side-panel-actions.ts";

/**
 * The diagram store owns the edited ER diagram.
 *
 * The diagram is kept in a `reactive` object so that the core commands, which
 * mutate the diagram in place, trigger Vue reactivity. Every mutation is
 * recorded in the history store, which makes undo/redo work across all
 * diagram changes.
 */
export const useDiagramStore = defineStore("diagram", () => {
  const history = useHistoryStore();

  const diagram = reactive(createEmptyDiagram()) as Diagram;

  /** Bumped on every change so that watchers can detect modifications. */
  const revision = ref(0);

  const tables = computed(() => diagram.tables);
  const relationships = computed(() => diagram.relationships);
  const notes = computed(() => diagram.notes);
  const areas = computed(() => diagram.areas ?? diagram.subjectAreas);
  const enums = computed(() => diagram.enums);
  const views = computed(() => diagram.views);
  const types = computed(() => diagram.types);

  function bump(): void {
    revision.value += 1;
  }

  function tableById(id: TableId): Table | undefined {
    return diagram.tables.find((table) => table.id === id);
  }

  function relationshipById(id: RelationshipId): Relationship | undefined {
    return diagram.relationships.find((relationship) => relationship.id === id);
  }

  function fieldById(tableId: TableId, fieldId: FieldId): Field | undefined {
    return tableById(tableId)?.fields.find((field) => field.id === fieldId);
  }

  /** Replaces the whole diagram and resets the undo history. */
  function setDiagram(next: Diagram): void {
    const empty = createEmptyDiagram();
    const target = diagram as unknown as Record<string, unknown>;
    for (const key of Object.keys(empty)) {
      delete target[key];
    }
    Object.assign(diagram, next);
    history.clear();
    bump();
  }

  function reset(): void {
    setDiagram(createEmptyDiagram());
  }

  /**
   * Changes a top level property of the diagram, for example its title or the
   * database it is written for. The change is undoable.
   */
  function updateDiagram(updates: DiagramProperties): void {
    history.execute(new UpdateDiagramCommand(diagram, updates));
    bump();
  }

  function addTable(table: Table): void {
    history.execute(new AddTableCommand(diagram, table));
    bump();
  }

  /**
   * Whether a table can be changed.
   *
   * A table that the user locked is a table the user does not want to touch
   * any more, so every change of it is refused. The refusal lives here and
   * not in the components, because the side panel changes a table as well and
   * the user expects the lock to hold there too.
   */
  function isLocked(tableId: TableId): boolean {
    return tableById(tableId)?.locked === true;
  }

  function updateTable(id: TableId, updates: Partial<Omit<Table, "id">>): void {
    if (isLocked(id)) {
      return;
    }
    history.execute(new UpdateTableCommand(diagram, id, updates));
    bump();
  }

  /**
   * Moves tables without recording the change, the live preview of a drag.
   *
   * The caller keeps the position of the start and commits the final one with
   * `updateTable`, so the preview is never the last word on the diagram.
   */
  function previewTablePositions(
    moves: ReadonlyArray<{ id: TableId; x: number; y: number }>,
  ): void {
    for (const move of moves) {
      const table = tableById(move.id);
      if (!table) continue;
      if (table.locked) continue;
      table.x = move.x;
      table.y = move.y;
    }
  }

  function removeTable(id: TableId): void {
    history.execute(new RemoveTableCommand(diagram, id));
    bump();
  }

  function addRelationship(relationship: Relationship): void {
    history.execute(new AddRelationshipCommand(diagram, relationship));
    bump();
  }

  function updateRelationship(
    id: RelationshipId,
    updates: Partial<Omit<Relationship, "id">>,
  ): void {
    history.execute(new UpdateRelationshipCommand(diagram, id, updates));
    bump();
  }

  function removeRelationship(id: RelationshipId): void {
    history.execute(new RemoveRelationshipCommand(diagram, id));
    bump();
  }

  function addField(tableId: TableId, field: Field, index?: number): void {
    if (isLocked(tableId)) {
      return;
    }
    history.execute(new AddFieldCommand(diagram, tableId, field, index));
    bump();
  }

  function updateField(
    tableId: TableId,
    fieldId: FieldId,
    updates: Partial<Omit<Field, "id">>,
  ): void {
    if (isLocked(tableId)) {
      return;
    }
    history.execute(new UpdateFieldCommand(diagram, tableId, fieldId, updates));
    bump();
  }

  function removeField(tableId: TableId, fieldId: FieldId): void {
    if (isLocked(tableId)) {
      return;
    }
    history.execute(new RemoveFieldCommand(diagram, tableId, fieldId));
    bump();
  }

  /** Moves a field of a table to another place. */
  function moveField(tableId: TableId, fromIndex: number, toIndex: number): void {
    if (isLocked(tableId)) {
      return;
    }
    history.execute(new MoveFieldCommand(diagram, tableId, fromIndex, toIndex));
    bump();
  }

  /** Changes the width of a table. */
  function resizeTable(tableId: TableId, width: number): void {
    if (isLocked(tableId)) {
      return;
    }
    history.execute(new ResizeTableCommand(diagram, tableId, width));
    bump();
  }

  /** Locks a table, so that it cannot be moved any more. */
  function toggleTableLock(tableId: TableId): void {
    history.execute(new ToggleTableLockCommand(diagram, tableId));
    bump();
  }

  /** Changes the header of the SQL that the diagram is exported to. */
  function updateSqlHeader(sqlHeader: string): void {
    history.execute(new UpdateDiagramCommand(diagram, { sqlHeader }));
    bump();
  }

  /**
   * Creates a batch of relationships the inference of the editor found.
   *
   * The batch is one entry of the history, so the undo takes all of them
   * away at once.
   */
  function applyRelationships(relationships: Relationship[]): void {
    if (relationships.length === 0) {
      return;
    }
    history.execute(new AddRelationshipsCommand(diagram, relationships));
    bump();
  }

  /** Moves the tables to the coordinates of an automatic layout. */
  function autoArrangeTables(): void {
    const positions = autoArrange(diagram.tables, diagram.relationships);
    const previous = diagram.tables.map((table) => ({
      x: table.x,
      y: table.y,
    }));
    history.execute(new AutoArrangeCommand(diagram, positions, previous));
    bump();
  }

  function setImportedDiagram(next: Diagram): void {
    setDiagram(next);
  }

  function addEntity(
    collection: DiagramEntityCollection,
    entity: DiagramEntityInput,
  ): void {
    history.execute(new AddEntityCommand(diagram, collection, entity));
    bump();
  }

  function removeEntity(
    collection: DiagramEntityCollection,
    target: string | number | undefined,
  ): void {
    history.execute(new RemoveEntityCommand(diagram, collection, target));
    bump();
  }

  const sidePanel = sidePanelActions(diagram, history, bump);
  const elements = elementActions(diagram, history, bump);

  return {
    diagram, revision, tables, relationships, notes, areas, enums, views, types,
    tableById, relationshipById, fieldById, isLocked,
    setDiagram, reset, updateDiagram,
    addTable, updateTable, removeTable,
    previewTablePositions,
    addRelationship, updateRelationship, removeRelationship,
    addField, updateField, removeField, moveField,
    resizeTable, toggleTableLock, updateSqlHeader,
    applyRelationships, autoArrange: autoArrangeTables, setImportedDiagram,
    addEntity, removeEntity,
    ...sidePanel, ...elements,
  };
});


export type DiagramStore = ReturnType<typeof useDiagramStore>;
