import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Diagram, Field, Relationship, Table } from "@drawdb/core";
import { useDiagramStore } from "./diagram.ts";
import { useHistoryStore } from "./history.ts";

function makeTable(id: string, name: string): Table {
  return {
    id,
    name,
    x: 0,
    y: 0,
    fields: [],
    metadata: {},
  };
}

function makeField(id: string, name: string): Field {
  return { id, name, type: "INTEGER", metadata: {} };
}

function makeRelationship(id: string, tableId: string): Relationship {
  return {
    id,
    startTableId: tableId,
    startFieldId: `${tableId}_fk`,
    endTableId: "other",
    endFieldId: "other_id",
    name: `fk_${tableId}`,
  };
}

describe("diagram store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("adds a table and grows the diagram", () => {
    const store = useDiagramStore();
    store.addTable(makeTable("t1", "users"));

    assert.equal(store.diagram.tables.length, 1);
    assert.equal(store.diagram.tables[0].name, "users");
    assert.equal(store.tables.length, 1);
  });

  it("records the change in the history store", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    assert.equal(history.canUndo, false);

    store.addTable(makeTable("t1", "users"));

    assert.equal(history.canUndo, true);
    assert.equal(history.depth, 1);
    assert.match(String(history.undoDescription), /Add table/);
  });

  it("undoes and redoes a table change", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addTable(makeTable("t1", "users"));
    assert.equal(history.undo(), true);

    assert.equal(store.diagram.tables.length, 0);
    assert.equal(history.canRedo, true);

    assert.equal(history.redo(), true);
    assert.equal(store.diagram.tables.length, 1);
    assert.equal(store.diagram.tables[0].name, "users");
  });

  it("updates a table and restores the previous state on undo", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addTable(makeTable("t1", "users"));
    store.updateTable("t1", { name: "people", x: 40 });

    assert.equal(store.diagram.tables[0].name, "people");
    assert.equal(store.diagram.tables[0].x, 40);

    history.undo();
    assert.equal(store.diagram.tables[0].name, "users");
    assert.equal(store.diagram.tables[0].x, 0);
  });

  it("removes a table together with its relationships", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addTable(makeTable("t1", "users"));
    store.addTable(makeTable("t2", "posts"));
    store.addRelationship(makeRelationship("r1", "t1"));
    store.addField("t2", makeField("f1", "user_id"));

    store.removeTable("t1");

    assert.equal(store.diagram.tables.length, 1);
    assert.equal(store.diagram.relationships.length, 0);

    history.undo();
    assert.equal(store.diagram.tables.length, 2);
    assert.equal(store.diagram.relationships.length, 1);
  });

  it("adds, updates and removes fields", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addTable(makeTable("t1", "users"));
    store.addField("t1", makeField("f1", "id"));
    store.addField("t1", makeField("f2", "email"));

    assert.equal(store.diagram.tables[0].fields.length, 2);

    store.updateField("t1", "f2", { type: "VARCHAR", size: 255 });
    assert.equal(store.fieldById("t1", "f2")?.type, "VARCHAR");

    store.removeField("t1", "f1");
    assert.equal(store.diagram.tables[0].fields.length, 1);

    history.undo();
    assert.equal(store.diagram.tables[0].fields.length, 2);
  });

  it("adds, updates and removes relationships", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addRelationship(makeRelationship("r1", "t1"));
    assert.equal(store.diagram.relationships.length, 1);

    store.updateRelationship("r1", { name: "fk_users_posts" });
    assert.equal(store.relationshipById("r1")?.name, "fk_users_posts");

    store.removeRelationship("r1");
    assert.equal(store.diagram.relationships.length, 0);

    history.undo();
    assert.equal(store.diagram.relationships.length, 1);
    assert.equal(store.relationshipById("r1")?.name, "fk_users_posts");
  });

  it("manages notes, areas, enums and views through entity commands", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addEntity("notes", { id: "n1", name: "note" });
    store.addEntity("areas", { id: "a1", name: "area" });
    store.addEntity("enums", { id: "e1", name: "status" });
    store.addEntity("views", { id: "v1", name: "active_users" });

    assert.equal(store.diagram.notes.length, 1);
    assert.equal(store.diagram.areas?.length, 1);
    assert.equal(store.diagram.enums.length, 1);
    assert.equal(store.diagram.views.length, 1);

    store.removeEntity("notes", "n1");
    assert.equal(store.diagram.notes.length, 0);

    history.undo();
    assert.equal(store.diagram.notes.length, 1);
  });

  it("replaces the diagram and clears the history", () => {
    const store = useDiagramStore();
    const history = useHistoryStore();

    store.addTable(makeTable("t1", "users"));
    assert.equal(history.canUndo, true);

    const next: Diagram = {
      ...store.diagram,
      id: "d1",
      title: "Other",
      tables: [makeTable("t9", "clients")],
    };
    store.setDiagram(next);

    assert.equal(store.diagram.title, "Other");
    assert.equal(store.diagram.tables.length, 1);
    assert.equal(store.diagram.tables[0].name, "clients");
    assert.equal(history.canUndo, false);
  });

  it("bumps the revision on every change", () => {
    const store = useDiagramStore();
    const start = store.revision;

    store.addTable(makeTable("t1", "users"));
    assert.equal(store.revision, start + 1);

    store.updateTable("t1", { name: "people" });
    assert.equal(store.revision, start + 2);
  });
});
