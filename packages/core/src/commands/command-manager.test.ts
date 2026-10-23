import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { CommandManager } from "./command-manager.ts";
import { AddTableCommand } from "./add-table.ts";
import { UpdateTableCommand } from "./update-table.ts";
import { RemoveTableCommand } from "./remove-table.ts";
import { AddRelationshipCommand } from "./add-relationship.ts";
import { UpdateFieldCommand } from "./update-field.ts";

const emptyTable = (id: string, name: string) => ({
  id,
  name,
  x: 0,
  y: 0,
  fields: [],
});

describe("command manager", () => {
  it("executes and undoes add table", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const manager = new CommandManager();
    const table = emptyTable("t1", "users");
    const command = new AddTableCommand(diagram, table);

    manager.execute(command);
    assert.equal(diagram.tables.length, 1);

    manager.undo();
    assert.equal(diagram.tables.length, 0);

    manager.redo();
    assert.equal(diagram.tables.length, 1);
  });

  it("clears redo stack on new execute", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const manager = new CommandManager();
    manager.execute(new AddTableCommand(diagram, emptyTable("t1", "a")));
    manager.undo();
    manager.execute(new AddTableCommand(diagram, emptyTable("t2", "b")));
    assert.equal(manager.canRedo, false);
  });

  it("updates and undoes a table", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const table = emptyTable("t1", "users");
    diagram.tables.push(table);

    const manager = new CommandManager();
    manager.execute(
      new UpdateTableCommand(diagram, "t1", { name: "accounts" }),
    );
    assert.equal(diagram.tables[0].name, "accounts");

    manager.undo();
    assert.equal(diagram.tables[0].name, "users");
  });

  it("removes a table and restores its relationships on undo", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    diagram.tables.push(emptyTable("t1", "users"));
    diagram.tables.push(emptyTable("t2", "posts"));
    diagram.relationships.push({
      id: "r1",
      startTableId: "t1",
      startFieldId: "f1",
      endTableId: "t2",
      endFieldId: "f2",
    });

    const manager = new CommandManager();
    manager.execute(new RemoveTableCommand(diagram, "t1"));
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.relationships.length, 0);

    manager.undo();
    assert.equal(diagram.tables.length, 2);
    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.tables[0].name, "users");
  });

  it("adds a relationship and undoes it", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const rel = {
      id: "r1",
      startTableId: "t1",
      startFieldId: "f1",
      endTableId: "t2",
      endFieldId: "f2",
    };

    const manager = new CommandManager();
    manager.execute(new AddRelationshipCommand(diagram, rel));
    assert.equal(diagram.relationships.length, 1);

    manager.undo();
    assert.equal(diagram.relationships.length, 0);
  });

  it("updates and undoes a field", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    diagram.tables.push({
      id: "t1",
      name: "users",
      x: 0,
      y: 0,
      fields: [{ id: "f1", name: "id", type: "INT" }],
    });

    const manager = new CommandManager();
    manager.execute(
      new UpdateFieldCommand(diagram, "t1", "f1", { type: "BIGINT" }),
    );
    assert.equal(diagram.tables[0].fields[0].type, "BIGINT");

    manager.undo();
    assert.equal(diagram.tables[0].fields[0].type, "INT");
  });
});
