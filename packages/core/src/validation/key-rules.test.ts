import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { checkKeys } from "./key-rules.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";

function field(id: string, name: string): Table["fields"][number] {
  return { id, name, fieldType: { type: "INTEGER" }, fieldTypeSource: "mapped" };
}

function table(id: string, name: string, extra: Partial<Table> = {}): Table {
  return {
    id,
    name,
    x: 0,
    y: 0,
    fields: [field(`${id}_id`, "id")],
    logical: { id: `l_${id}`, name, attributes: [] },
    ...extra,
  };
}

function diagram(tables: Table[]): Diagram {
  const empty = createEmptyDiagram({ database: "mysql" });
  empty.tables = tables;
  return empty;
}

function codes(target: Diagram): string[] {
  return checkKeys(target).map((issue) => issue.code);
}

describe("key rules (P2' task 4)", () => {
  it("reports an index that names a field the table does not have", () => {
    const target = diagram([
      table("t1", "users", {
        indices: [
          { id: "i1", name: "Idx_a", unique: false, columns: [{ fieldId: "ghost" }] },
        ],
      }),
    ]);

    assert.ok(codes(target).includes("index.unknown_field"));
  });

  it("reports an index name used in two tables, because names are schema-wide", () => {
    const target = diagram([
      table("t1", "users", {
        indices: [{ id: "i1", name: "Idx_same", unique: false, columns: [{ fieldId: "t1_id" }] }],
      }),
      table("t2", "posts", {
        indices: [{ id: "i2", name: "idx_same", unique: false, columns: [{ fieldId: "t2_id" }] }],
      }),
    ]);

    const issues = checkKeys(target).filter((issue) => issue.code === "index.duplicate_schema_name");
    assert.equal(issues.length, 2, "both tables are told about it");
  });

  it("reports a constraint name that an index already uses", () => {
    const target = diagram([
      table("t1", "users", {
        uniqueKeys: [{ id: "u1", name: "Idx_shared", logicalName: "UK_one", columns: [{ fieldId: "t1_id" }] }],
        indices: [{ id: "i1", name: "Idx_shared", unique: false, columns: [{ fieldId: "t1_id" }] }],
      }),
    ]);

    assert.ok(codes(target).includes("constraint.duplicate_schema_name"));
  });

  it("reports two keys of a table that share a logical name", () => {
    const target = diagram([
      table("t1", "users", {
        uniqueKeys: [
          { id: "u1", name: "UK_a", logicalName: "UK_same", columns: [{ fieldId: "t1_id" }] },
          { id: "u2", name: "UK_b", logicalName: "uk_same", columns: [{ fieldId: "t1_id" }] },
        ],
        indices: [{ id: "i1", name: "Idx_same", logicalName: "UK_same", unique: false, columns: [{ fieldId: "t1_id" }] }],
      }),
    ]);

    const issues = checkKeys(target).filter((issue) => issue.code === "constraint.duplicate_logical_name");
    assert.ok(issues.length > 0);
    assert.equal(issues[0]?.severity, "warning");
  });

  it("reports a key without columns or with a column that is gone", () => {
    const target = diagram([
      table("t1", "users", {
        uniqueKeys: [{ id: "u1", name: "UK_empty", logicalName: "UK_empty", columns: [] }],
        primaryKey: { id: "p1", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "ghost" }] },
      }),
    ]);

    const found = checkKeys(target).filter((issue) => issue.code === "constraint.no_columns");
    assert.equal(found.length, 2);
    assert.equal(found[0]?.severity, "error");
  });

  it("reports a foreign key without a relationship and a relationship without a key", () => {
    const target = diagram([
      table("t1", "users"),
      table("t2", "posts", {
        foreignKeys: [{ id: "fk_1", name: "FK_posts_users", logicalName: "FK_post_user", relationshipId: "gone" }],
      }),
    ]);
    target.relationships = [
      {
        id: "r1",
        startTableId: "t2",
        startFieldId: "t2_id",
        endTableId: "t1",
        endFieldId: "t1_id",
      },
      {
        id: "r2",
        startTableId: "t2",
        startFieldId: "t2_id",
        endTableId: "t1",
        endFieldId: "t1_id",
      },
    ];

    const found = codes(target);
    assert.ok(found.includes("constraint.fk_without_relationship"));
    assert.ok(found.includes("constraint.relationship_without_fk"));
  });

  it("reports two indices over the same columns and a unique key that duplicates one", () => {
    const target = diagram([
      table("t1", "users", {
        indices: [
          { id: "i1", name: "Idx_a", unique: false, columns: [{ fieldId: "t1_id" }] },
          { id: "i2", name: "Idx_b", unique: true, columns: [{ fieldId: "t1_id" }] },
        ],
        uniqueKeys: [{ id: "u1", name: "UK_a", logicalName: "UK_a", columns: [{ fieldId: "t1_id" }] }],
      }),
    ]);

    const found = codes(target);
    assert.ok(found.includes("index.duplicate_columns"));
    assert.ok(found.includes("index.unique_constraint_conflict"));
  });

  it("reports the support of a relationship that is not there", () => {
    const target = diagram([
      table("t1", "users", {
        indices: [
          {
            id: "i1",
            name: "Idx_a",
            unique: false,
            columns: [{ fieldId: "t1_id" }],
            supportsRelationshipId: "gone",
          },
        ],
      }),
    ]);
    target.relationships = [
      { id: "r1", startTableId: "t1", startFieldId: "t1_id", endTableId: "t1", endFieldId: "t1_id" },
    ];

    const found = codes(target);
    assert.ok(found.includes("index.no_supporting_relationship"));
    assert.ok(found.includes("index.relationship_without_index"));
  });
});
