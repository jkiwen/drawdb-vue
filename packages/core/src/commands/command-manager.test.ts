import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { CommandManager } from "./command-manager.ts";
import { AddTableCommand, RemoveTableCommand, UpdateTableCommand } from "./table-commands.ts";
import { AddRelationshipCommand } from "./relationship-commands.ts";
import { UpdateFieldCommand } from "./field-commands.ts";

const emptyTable = (id: string, name: string) => ({
  id,
  name,
  x: 0,
  y: 0,
  fields: [],
  logical: { id: `le-${id}`, name, attributes: [] },
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
      logical: { id: "le-t1", name: "users", attributes: [] },
      fields: [
        {
          id: "f1",
          name: "id",
          fieldType: { type: "INT" },
          fieldTypeSource: "explicit",
        },
      ],
    });

    const manager = new CommandManager();
    manager.execute(
      new UpdateFieldCommand(diagram, "t1", "f1", {
        fieldType: { type: "BIGINT" },
      }),
    );
    assert.equal(diagram.tables[0].fields[0].fieldType.type, "BIGINT");

    manager.undo();
    assert.equal(diagram.tables[0].fields[0].fieldType.type, "INT");
  });
});

describe("the manager jumps to a position of the history", () => {
  function threeCommands() {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const manager = new CommandManager();
    for (const name of ["a", "b", "c"]) {
      manager.execute(new AddTableCommand(diagram, emptyTable(name, name)));
    }
    return { diagram, manager };
  }

  it("undoes back to the position", () => {
    const { diagram, manager } = threeCommands();
    assert.equal(manager.jumpTo(1), true);
    assert.equal(diagram.tables.length, 1);
    assert.equal(manager.canRedo, true);
  });

  it("redoes forward to the position", () => {
    const { diagram, manager } = threeCommands();
    manager.jumpTo(0);
    assert.equal(diagram.tables.length, 0);
    assert.equal(manager.jumpTo(3), true);
    assert.equal(diagram.tables.length, 3);
    assert.equal(manager.canRedo, false);
  });

  it("does nothing when the position is the current one", () => {
    const { diagram, manager } = threeCommands();
    assert.equal(manager.jumpTo(3), true);
    assert.equal(diagram.tables.length, 3);
  });

  it("clamps a position beyond the history and says it did not land there", () => {
    const { diagram, manager } = threeCommands();
    // A position the history cannot reach lands on the closest one it can,
    // and the answer says that the exact position was not reached.
    assert.equal(manager.jumpTo(99), false);
    assert.equal(diagram.tables.length, 3);
    assert.equal(manager.jumpTo(-4), false);
    assert.equal(diagram.tables.length, 0);
  });

  it("skips a cleared history", () => {
    const { diagram, manager } = threeCommands();
    manager.undo();
    manager.clear();
    // The history is gone, so no position is reachable any more.
    assert.equal(manager.jumpTo(2), false);
    assert.equal(diagram.tables.length, 2);
    assert.equal(manager.canUndo, false);
  });
});
