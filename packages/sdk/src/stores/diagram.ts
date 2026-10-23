import {
  AddEntityCommand,
  AddFieldCommand,
  AddRelationshipCommand,
  AddTableCommand,
  RemoveEntityCommand,
  RemoveFieldCommand,
  RemoveRelationshipCommand,
  RemoveTableCommand,
  UpdateFieldCommand,
  UpdateRelationshipCommand,
  UpdateTableCommand,
  UpdateDiagramCommand,
  createEmptyDiagram,
} from "@drawdb/core";
import type {
  Diagram,
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

  function fieldById(
    tableId: TableId,
    fieldId: FieldId,
  ): Field | undefined {
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

  function updateTable(
    id: TableId,
    updates: Partial<Omit<Table, "id">>,
  ): void {
    history.execute(new UpdateTableCommand(diagram, id, updates));
    bump();
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
    history.execute(new AddFieldCommand(diagram, tableId, field, index));
    bump();
  }

  function updateField(
    tableId: TableId,
    fieldId: FieldId,
    updates: Partial<Omit<Field, "id">>,
  ): void {
    history.execute(new UpdateFieldCommand(diagram, tableId, fieldId, updates));
    bump();
  }

  function removeField(tableId: TableId, fieldId: FieldId): void {
    history.execute(new RemoveFieldCommand(diagram, tableId, fieldId));
    bump();
  }

  function addEntity(
    collection: DiagramEntityCollection,
    entity: { id?: string | number; name?: string; [key: string]: unknown },
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

  return {
    diagram,
    revision,
    tables,
    relationships,
    notes,
    areas,
    enums,
    views,
    types,
    tableById,
    relationshipById,
    fieldById,
    setDiagram,
    reset,
    updateDiagram,
    addTable,
    updateTable,
    removeTable,
    addRelationship,
    updateRelationship,
    removeRelationship,
    addField,
    updateField,
    removeField,
    addEntity,
    removeEntity,
  };
});

export type DiagramStore = ReturnType<typeof useDiagramStore>;
