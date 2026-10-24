import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { Note } from "../models/note.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import { deepClone } from "../utils/clone.ts";
import { AutoArrangeCommand } from "./auto-arrange-command.ts";
import { CompositeCommand } from "./composite-command.ts";
import {
  AddEntityCommand,
  RemoveEntityCommand,
  UpdateEntityCommand,
} from "./collection-commands.ts";
import {
  AddFieldCommand,
  MoveFieldCommand,
  RemoveFieldCommand,
  UpdateFieldCommand,
} from "./field-commands.ts";
import {
  AddRelationshipCommand,
  AddRelationshipsCommand,
  RemoveRelationshipCommand,
  UpdateRelationshipCommand,
} from "./relationship-commands.ts";
import {
  AddTableCommand,
  RemoveTableCommand,
  ResizeTableCommand,
  ToggleTableLockCommand,
  UpdateTableCommand,
} from "./table-commands.ts";

/** A table with the fields of a simple schema. */
function table(id: string, name: string, fields: Field[] = []): Table {
  return { id, name, x: 0, y: 0, fields };
}

/** A field of a table. */
function field(id: string, name: string, overrides: Partial<Field> = {}): Field {
  return { id, name, type: "INTEGER", ...overrides };
}

/** A relationship between two tables. */
function relationship(
  id: string,
  overrides: Partial<Relationship> = {},
): Relationship {
  return {
    id,
    startTableId: "t1",
    startFieldId: "f1",
    endTableId: "t2",
    endFieldId: "f2",
    ...overrides,
  };
}

/** A diagram with two tables, three fields and one relationship. */
function sample(): Diagram {
  const diagram = createEmptyDiagram({ database: "mysql" });
  diagram.tables = [
    table("t1", "users", [field("f1", "id", { primary: true })]),
    table("t2", "posts", [field("f2", "id", { primary: true })]),
  ];
  diagram.relationships = [relationship("r1")];
  return diagram;
}

test("commands: AddTableCommand adds the table and undo removes it", () => {
  const diagram = createEmptyDiagram();

  new AddTableCommand(diagram, table("t1", "users")).execute();
  assert.equal(diagram.tables.length, 1);

  // The undo of a fresh command is a no-op, the manager calls undo after execute.
  const command = new AddTableCommand(diagram, table("t2", "posts"));
  command.execute();
  assert.equal(diagram.tables.length, 2);
  command.undo();
  assert.equal(diagram.tables.length, 1);
});

test("commands: UpdateTableCommand updates the table and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new UpdateTableCommand(diagram, "t1", { name: "accounts" });
  command.execute();
  assert.equal(diagram.tables[0].name, "accounts");

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: RemoveTableCommand removes the table and its relationships and undo restores them", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new RemoveTableCommand(diagram, "t1");
  command.execute();
  assert.equal(diagram.tables.length, 1);
  assert.equal(diagram.relationships.length, 0);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: ResizeTableCommand changes the width and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new ResizeTableCommand(diagram, "t1", 400);
  command.execute();
  assert.equal(diagram.tables[0].width, 400);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: ToggleTableLockCommand flips the flag and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new ToggleTableLockCommand(diagram, "t1");
  command.execute();
  assert.equal(diagram.tables[0].locked, true);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: AddFieldCommand inserts at the given index and undo removes it", () => {
  const diagram = sample();

  const command = new AddFieldCommand(diagram, "t1", field("f9", "name"), 0);
  command.execute();
  assert.deepEqual(
    diagram.tables[0].fields.map((f) => f.name),
    ["name", "id"],
  );

  command.undo();
  assert.deepEqual(
    diagram.tables[0].fields.map((f) => f.name),
    ["id"],
  );
});

test("commands: UpdateFieldCommand keeps the other fields untouched", () => {
  const diagram = sample();
  diagram.tables[0].fields.push(field("f3", "name"));

  const command = new UpdateFieldCommand(diagram, "t1", "f1", {
    name: "identifier",
  });
  command.execute();
  assert.equal(diagram.tables[0].fields[0].name, "identifier");
  assert.equal(diagram.tables[0].fields[1].name, "name");
  assert.equal(diagram.tables[1].fields[0].name, "id");
});

test("commands: RemoveFieldCommand removes the field and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new RemoveFieldCommand(diagram, "t1", "f1");
  command.execute();
  assert.equal(diagram.tables[0].fields.length, 0);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: MoveFieldCommand moves a field and undo restores the order", () => {
  const diagram = sample();
  diagram.tables[0].fields = [
    field("f1", "id"),
    field("f3", "name"),
    field("f4", "email"),
  ];
  const before = deepClone(diagram);

  const command = new MoveFieldCommand(diagram, "t1", 2, 0);
  command.execute();
  assert.deepEqual(
    diagram.tables[0].fields.map((f) => f.name),
    ["email", "id", "name"],
  );

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: MoveFieldCommand does nothing when the indexes are equal", () => {
  const diagram = sample();
  diagram.tables[0].fields = [field("f1", "id"), field("f3", "name")];
  const before = deepClone(diagram);

  const command = new MoveFieldCommand(diagram, "t1", 1, 1);
  command.execute();

  assert.deepEqual(diagram, before);
});

test("commands: AddRelationshipCommand adds the relationship and undo removes it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new AddRelationshipCommand(diagram, relationship("r2"));
  command.execute();
  assert.equal(diagram.relationships.length, 2);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: UpdateRelationshipCommand updates the relationship and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new UpdateRelationshipCommand(diagram, "r1", {
    name: "fk_posts_user",
  });
  command.execute();
  assert.equal(diagram.relationships[0].name, "fk_posts_user");

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: RemoveRelationshipCommand removes the relationship and undo restores it", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new RemoveRelationshipCommand(diagram, "r1");
  command.execute();
  assert.equal(diagram.relationships.length, 0);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: AddRelationshipsCommand adds every relationship and undo removes them", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new AddRelationshipsCommand(diagram, [
    relationship("r2"),
    relationship("r3"),
  ]);
  command.execute();
  assert.equal(diagram.relationships.length, 3);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: AddEntityCommand adds a note and undo removes it", () => {
  const diagram = sample();
  const note: Note = { id: "n1", x: 0, y: 0, title: "Note", content: "Text" };

  const command = new AddEntityCommand(diagram, "notes", note);
  command.execute();
  assert.equal(diagram.notes.length, 1);

  command.undo();
  assert.equal(diagram.notes.length, 0);
});

test("commands: UpdateEntityCommand updates a view and undo restores it", () => {
  const diagram = sample();
  diagram.views = [
    { id: "v1", name: "active_users", x: 0, y: 0, baseTableId: "t1" },
  ];
  const before = deepClone(diagram);

  const command = new UpdateEntityCommand(diagram, "views", "v1", {
    name: "all_users",
  });
  command.execute();
  assert.equal(diagram.views[0].name, "all_users");

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: RemoveEntityCommand removes a note and undo restores it", () => {
  const diagram = sample();
  diagram.notes = [{ id: "n1", x: 0, y: 0, title: "Note", content: "Text" }];
  const before = deepClone(diagram);

  const command = new RemoveEntityCommand(diagram, "notes", "n1");
  command.execute();
  assert.equal(diagram.notes.length, 0);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: AutoArrangeCommand moves the tables and undo restores the previous coordinates", () => {
  const diagram = sample();
  diagram.tables[0].x = 10;
  diagram.tables[1].x = 20;
  const before = deepClone(diagram);

  const command = new AutoArrangeCommand(
    diagram,
    [
      { x: 100, y: 200 },
      { x: 300, y: 400 },
    ],
    [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ],
  );
  command.execute();
  assert.equal(diagram.tables[0].x, 100);
  assert.equal(diagram.tables[1].y, 400);

  command.undo();
  assert.deepEqual(diagram, before);
});

test("commands: CompositeCommand takes the changes it wraps back at once", () => {
  const diagram = sample();
  const before = deepClone(diagram);

  const command = new CompositeCommand("Move the tables", [
    new UpdateTableCommand(diagram, diagram.tables[0].id, { x: 300 }),
    new UpdateTableCommand(diagram, diagram.tables[1].id, { y: 400 }),
  ]);
  command.execute();
  assert.equal(diagram.tables[0].x, 300);
  assert.equal(diagram.tables[1].y, 400);

  command.undo();
  assert.deepEqual(diagram, before);
});
