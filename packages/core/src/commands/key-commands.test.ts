import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  addTableKey,
  removeTableKey,
  renameTableKey,
  setKeyColumns,
} from "./key-commands.ts";
import { CommandManager } from "./command-manager.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";

function field(id: string, name: string): Table["fields"][number] {
  return { id, name, fieldType: { type: "INTEGER" }, fieldTypeSource: "mapped" };
}

function diagram(): Diagram {
  const empty = createEmptyDiagram({ database: "mysql" });
  empty.tables = [
    {
      id: "t_users",
      name: "users",
      x: 0,
      y: 0,
      fields: [field("f_id", "id"), field("f_email", "email"), field("f_name", "name")],
      logical: { id: "l_users", name: "user", attributes: [] },
      uniqueKeys: [
        { id: "uk_1", logicalName: "UK_email", name: "UK_email", columns: [{ fieldId: "f_email" }] },
      ],
      indices: [
        { id: "idx_1", logicalName: "Idx_name", name: "Idx_name", unique: false, columns: [{ fieldId: "f_name" }] },
      ],
    },
  ];
  return empty;
}

function users(target: Diagram): Table {
  const table = target.tables.find((entry) => entry.id === "t_users");
  assert.ok(table);
  return table;
}

describe("key commands (P2' task 3)", () => {
  it("adds a unique key in one step and takes it back in one", () => {
    const target = diagram();
    const history = new CommandManager();
    const command = addTableKey(target, "t_users", "unique", {
      id: "uk_2",
      logicalName: "UK_name",
      name: "UK_name",
      columns: [{ fieldId: "f_name" }],
    });

    history.execute(command);

    assert.equal(users(target).uniqueKeys?.length, 2);
    assert.match(command.description, /UK_name/);

    history.undo();

    assert.equal(users(target).uniqueKeys?.length, 1);
    assert.equal(users(target).uniqueKeys?.[0]?.name, "UK_email");
  });

  it("renames a key and keeps its columns", () => {
    const target = diagram();
    const history = new CommandManager();

    history.execute(renameTableKey(target, "t_users", "unique", "uk_1", {
      logicalName: "UK_email_address",
      name: "uk_email_address",
    }));

    assert.equal(users(target).uniqueKeys?.[0]?.name, "uk_email_address");
    assert.deepEqual(users(target).uniqueKeys?.[0]?.columns, [{ fieldId: "f_email" }]);

    history.undo();

    assert.equal(users(target).uniqueKeys?.[0]?.name, "UK_email");
  });

  it("reorders the columns of an index in one step", () => {
    const target = diagram();
    const history = new CommandManager();

    history.execute(
      setKeyColumns(target, "t_users", "index", "idx_1", [
        { fieldId: "f_name", order: "desc" },
        { fieldId: "f_email" },
      ]),
    );

    assert.deepEqual(users(target).indices?.[0]?.columns, [
      { fieldId: "f_name", order: "desc" },
      { fieldId: "f_email" },
    ]);

    history.undo();

    assert.deepEqual(users(target).indices?.[0]?.columns, [{ fieldId: "f_name" }]);
  });

  it("removes a key and puts it back at its place", () => {
    const target = diagram();
    const history = new CommandManager();
    const command = removeTableKey(target, "t_users", "unique", "uk_1");

    history.execute(command);

    assert.equal(users(target).uniqueKeys?.length, 0);

    history.undo();

    assert.equal(users(target).uniqueKeys?.[0]?.id, "uk_1", "the order of the keys is kept");
  });

  it("describes what it changes", () => {
    const target = diagram();

    assert.match(addTableKey(target, "t_users", "index", {
      id: "idx_2",
      logicalName: "Idx_email",
      name: "Idx_email",
      unique: false,
      columns: [],
    }).description, /Idx_email/);
    assert.match(renameTableKey(target, "t_users", "index", "idx_1", { name: "idx_by_name" }).description, /idx_by_name/);
    assert.match(removeTableKey(target, "t_users", "index", "idx_1").description, /Idx_name/);
    assert.match(setKeyColumns(target, "t_users", "index", "idx_1", []).description, /Idx_name/);
  });
});
