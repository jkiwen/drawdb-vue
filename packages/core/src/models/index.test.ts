import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "./diagram.ts";
import type { Diagram } from "./diagram.ts";

describe("createEmptyDiagram", () => {
  it("returns a generic empty diagram by default", () => {
    const d = createEmptyDiagram();
    assert.equal(d.database, "generic");
    assert.equal(d.title, "");
    assert.equal(d.sqlHeader, "");
    assert.deepEqual(d.tables, []);
    assert.deepEqual(d.relationships, []);
    assert.deepEqual(d.notes, []);
    assert.deepEqual(d.subjectAreas, []);
    assert.deepEqual(d.types, []);
    assert.deepEqual(d.enums, []);
    assert.deepEqual(d.views, []);
    assert.deepEqual(d.metadata, {});
  });

  it("accepts database, title, and id options", () => {
    const d = createEmptyDiagram({
      database: "postgres",
      title: "User schema",
      id: "diag-1",
    });
    assert.equal(d.database, "postgres");
    assert.equal(d.title, "User schema");
    assert.equal(d.id, "diag-1");
  });

  it("round-trips a populated diagram through JSON", () => {
    const d: Diagram = {
      ...createEmptyDiagram({ database: "mysql" }),
      tables: [
        {
          id: "t1",
          name: "users",
          x: 100,
          y: 200,
          logical: { id: "le-t1", name: "users", attributes: [] },
          fields: [
            {
              id: "f1",
              name: "id",
              fieldType: { type: "bigint" },
              fieldTypeSource: "explicit",
              nullable: false,
              primary: true,
              metadata: { owner: "platform" },
            },
          ],
          indices: [{ name: "pk_users", unique: true, fields: ["f1"] }],
        },
      ],
      relationships: [
        {
          id: "r1",
          startTableId: "t1",
          startFieldId: "f1",
          endTableId: "t2",
          endFieldId: "f2",
          cardinality: "one_to_many",
        },
      ],
      notes: [
        {
          id: "n1",
          x: 0,
          y: 0,
          title: "Note",
          content: "content",
        },
      ],
      subjectAreas: [
        {
          id: "a1",
          name: "Auth",
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          color: "#175e7a",
        },
      ],
      enums: [{ id: "e1", name: "status", values: ["active", "inactive"] }],
      types: [
        {
          id: "ct1",
          name: "point",
          fields: [{ name: "x", type: "int" }],
        },
      ],
      views: [
        {
          id: "v1",
          name: "active_users",
          x: 300,
          y: 300,
        },
      ],
      metadata: { version: "1" },
    };

    const json = JSON.parse(JSON.stringify(d)) as Diagram;
    assert.equal(json.database, "mysql");
    assert.equal(json.tables[0].fields[0].name, "id");
    assert.equal(json.tables[0].fields[0].metadata?.owner, "platform");
    assert.equal(json.relationships[0].cardinality, "one_to_many");
    assert.equal(json.subjectAreas[0].color, "#175e7a");
    assert.deepEqual(json.enums[0].values, ["active", "inactive"]);
  });
});
