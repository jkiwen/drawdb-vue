import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { exportDiagramJson } from "./export.ts";
import { importDiagramJson } from "./import.ts";
import type { Diagram } from "../models/diagram.ts";

/**
 * A document written before the keys became objects: the primary flag sits on
 * the fields, the unique constraint and the index hold field names, and the
 * relationship carries the name of the foreign key.
 */
function legacyDocument(): Record<string, unknown> {
  return {
    database: "mysql",
    title: "legacy",
    tables: [
      {
        id: "t_users",
        name: "users",
        x: 0,
        y: 0,
        fields: [
          { id: "f_id", name: "id", type: "INTEGER", primary: true },
          { id: "f_email", name: "email", type: "VARCHAR", size: 255, unique: true },
        ],
        uniqueConstraints: [{ name: "uq_email", fields: ["email"] }],
        indices: [{ name: "idx_email", unique: false, fields: ["email"] }],
      },
      {
        id: "t_posts",
        name: "posts",
        x: 400,
        y: 0,
        fields: [
          { id: "f_post_id", name: "id", type: "INTEGER", primary: true },
          { id: "f_user_id", name: "user_id", type: "INTEGER" },
        ],
      },
    ],
    relationships: [
      {
        id: "r_1",
        name: "fk_posts_user",
        startTableId: "t_posts",
        startFieldId: "f_user_id",
        endTableId: "t_users",
        endFieldId: "f_id",
      },
    ],
  };
}

function tableOf(diagram: Diagram, id: string) {
  return diagram.tables.find((table) => table.id === id);
}

describe("keys survive a trip through the document (P2' task 2)", () => {
  it("reads the keys of a legacy document as objects", () => {
    const diagram = importDiagramJson(JSON.stringify(legacyDocument()));
    const users = tableOf(diagram, "t_users");
    const posts = tableOf(diagram, "t_posts");

    assert.deepEqual(users?.primaryKey?.columns, [{ fieldId: "f_id" }]);
    assert.equal(users?.primaryKey?.name, "PK_users");
    assert.deepEqual(users?.uniqueKeys?.[0]?.columns, [{ fieldId: "f_email" }]);
    assert.equal(users?.uniqueKeys?.[0]?.name, "uq_email");
    assert.deepEqual(users?.indices?.[0]?.columns, [{ fieldId: "f_email" }]);
    assert.equal(users?.indices?.[0]?.name, "idx_email", "the name of the index is kept");
    assert.equal(posts?.foreignKeys?.[0]?.name, "fk_posts_user");
    assert.equal(posts?.foreignKeys?.[0]?.relationshipId, "r_1");
  });

  it("keeps the same keys when the document is written and read again", () => {
    const first = importDiagramJson(JSON.stringify(legacyDocument()));
    const json = exportDiagramJson(first);
    const second = importDiagramJson(json);

    for (const id of ["t_users", "t_posts"]) {
      const before = tableOf(first, id);
      const after = tableOf(second, id);

      assert.deepEqual(after?.primaryKey, before?.primaryKey, `${id}: primary key`);
      assert.deepEqual(after?.uniqueKeys, before?.uniqueKeys, `${id}: unique keys`);
      assert.deepEqual(after?.foreignKeys, before?.foreignKeys, `${id}: foreign keys`);
      assert.deepEqual(after?.indices, before?.indices, `${id}: indices`);
    }
  });

  it("leaves a document without keys without keys", () => {
    const bare = {
      database: "mysql",
      tables: [
        {
          id: "t_once",
          name: "once",
          x: 0,
          y: 0,
          fields: [{ id: "f_a", name: "a", type: "INTEGER" }],
        },
      ],
      relationships: [],
    };

    const table = tableOf(importDiagramJson(JSON.stringify(bare)), "t_once");

    assert.equal(table?.primaryKey, undefined);
    assert.equal(table?.uniqueKeys, undefined);
    assert.equal(table?.foreignKeys, undefined);
  });
});
