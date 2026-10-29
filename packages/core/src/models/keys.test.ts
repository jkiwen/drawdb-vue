import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ForeignKey, Index, IndexColumn, PrimaryKey, UniqueKey } from "./keys.ts";
import { keyChannelsOf, keyColumns } from "./keys.ts";
import type { Table } from "./table.ts";

const column = (fieldId: string, order?: "asc" | "desc"): IndexColumn =>
  order ? { fieldId, order } : { fieldId };

const table = (patch: Partial<Table> = {}): Table => ({
  id: "t1",
  name: "users",
  logical: { id: "le-t1", name: "user", attributes: [] },
  x: 0,
  y: 0,
  fields: [
    { id: "f1", name: "id", fieldType: { type: "integer" }, fieldTypeSource: "explicit" },
    { id: "f2", name: "email", fieldType: { type: "string" }, fieldTypeSource: "explicit" },
  ],
  ...patch,
});

describe("keyColumns", () => {
  it("returns the columns of every kind in their order", () => {
    const primary: PrimaryKey = {
      id: "pk1",
      logicalName: "PK_user",
      name: "PK_users",
      columns: [column("f1")],
    };
    const unique: UniqueKey = {
      id: "uk1",
      logicalName: "UK_user_email",
      name: "UK_users_email",
      columns: [column("f2", "desc")],
    };
    const index: Index = {
      id: "idx1",
      logicalName: "Idx_user_email",
      name: "Idx_users_email",
      unique: false,
      columns: [column("f2"), column("f1")],
    };

    assert.deepEqual(keyColumns(primary), [column("f1")]);
    assert.deepEqual(keyColumns(unique), [column("f2", "desc")]);
    assert.deepEqual(keyColumns(index), [column("f2"), column("f1")]);
  });

  it("leaves a foreign key without columns of its own", () => {
    const foreign: ForeignKey = {
      id: "fk1",
      logicalName: "FK_post_user",
      name: "FK_posts_users",
      relationshipId: "r1",
    };

    assert.deepEqual(keyColumns(foreign), []);
  });
});

describe("keyChannelsOf", () => {
  it("lists the keys a table holds, one channel per kind", () => {
    const tableWithKeys = table({
      primaryKey: {
        id: "pk1",
        logicalName: "PK_user",
        name: "PK_users",
        columns: [column("f1")],
      },
      uniqueKeys: [
        { id: "uk1", logicalName: "UK_user_email", name: "UK_users_email", columns: [column("f2")] },
      ],
      foreignKeys: [
        { id: "fk1", logicalName: "FK_post_user", name: "FK_posts_users", relationshipId: "r1" },
      ],
      indices: [
        {
          id: "idx1",
          logicalName: "Idx_user_email",
          name: "Idx_users_email",
          unique: false,
          columns: [column("f2")],
        },
      ],
    });

    assert.deepEqual(
      keyChannelsOf(tableWithKeys).map((channel) => channel.kind),
      ["primary", "unique", "foreign", "index"],
    );
    assert.deepEqual(
      keyChannelsOf(tableWithKeys).map((channel) => channel.keys.length),
      [1, 1, 1, 1],
    );
  });

  it("keeps an empty kind empty instead of inventing a key", () => {
    const channels = keyChannelsOf(table());

    assert.equal(channels.length, 4);
    assert.deepEqual(
      channels.map((channel) => channel.keys.length),
      [0, 0, 0, 0],
    );
  });
});
