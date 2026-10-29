import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";
import { DBMLParseError, diffDBML, exportDBML, parseDBML } from "./index.ts";

const SAMPLE_DBML = `enum user_status {
  active
  inactive
}

Table users [headercolor: #175e7a] {
  id integer [pk, increment]
  email varchar(255) [not null, unique]
  status user_status [not null]
  created_at timestamp
  Note: 'user table'
}

Table posts {
  id integer [pk]
  title varchar(200) [not null]
  user_id integer [not null]

  indexes {
    (user_id) [name: 'idx_posts_user']
  }
}

Ref fk_posts_user {
  posts.user_id > users.id [delete: cascade, update: no action]
}
`;

function tableByName(diagram: Diagram, name: string): Table {
  const table = diagram.tables.find((t) => t.name === name);
  assert.ok(table, `table ${name} should exist`);
  return table;
}

describe("parseDBML", () => {
  it("parses tables, enums and relationships", () => {
    const diagram = parseDBML(SAMPLE_DBML, { database: "mysql" });

    assert.equal(diagram.database, "mysql");
    assert.equal(diagram.tables.length, 2);
    assert.equal(diagram.enums.length, 1);
    assert.equal(diagram.relationships.length, 1);
  });

  it("parses table names, comments and colors", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const users = tableByName(diagram, "users");

    assert.equal(users.comment, "user table");
    assert.equal(users.color, "#175e7a");
  });

  it("parses field flags", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const users = tableByName(diagram, "users");
    const id = users.fields.find((f) => f.name === "id");
    const email = users.fields.find((f) => f.name === "email");

    assert.equal(id?.fieldType.type, "INTEGER");
    assert.deepEqual(users.primaryKey?.columns, [{ fieldId: id?.id }]);
    assert.equal(id?.increment, true);
    assert.equal(email?.fieldType.type, "VARCHAR");
    assert.equal(email?.fieldType.length, 255);
    assert.equal(email?.notNull, true);
    assert.equal(email?.unique, true);
  });

  it("parses enum values", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    assert.deepEqual(diagram.enums[0].values, ["active", "inactive"]);
  });

  it("parses indexes", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const posts = tableByName(diagram, "posts");

    assert.equal(posts.indices?.length, 1);
    assert.equal(posts.indices?.[0].name, "idx_posts_user");
    assert.deepEqual(
      posts.indices?.[0].columns.map(
        (column) => posts.fields.find((f) => f.id === column.fieldId)?.name,
      ),
      ["user_id"],
    );
  });

  it("parses relationships with cardinality and constraints", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const rel = diagram.relationships[0];

    assert.equal(rel.name, "fk_posts_user");
    assert.equal(rel.cardinality, "many_to_one");
    assert.equal(rel.deleteConstraint, "Cascade");
    assert.equal(rel.updateConstraint, "No action");
  });

  it("resolves relationship endpoints to table and field ids", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const rel = diagram.relationships[0];
    const posts = tableByName(diagram, "posts");
    const users = tableByName(diagram, "users");

    assert.equal(rel.startTableId, posts.id);
    assert.equal(rel.endTableId, users.id);
    assert.equal(
      posts.fields.find((f) => f.id === rel.startFieldId)?.name,
      "user_id",
    );
    assert.equal(users.fields.find((f) => f.id === rel.endFieldId)?.name, "id");
  });

  it("detects a composite primary key from an indexes block", () => {
    const diagram = parseDBML(`Table pair {
  a integer
  b integer

  indexes {
    (a, b) [name: 'pk_pair', pk]
  }
}
`);
    const pair = tableByName(diagram, "pair");
    assert.equal(pair.primaryKey?.name, "PK_pair");
    assert.deepEqual(
      pair.primaryKey?.columns.map(
        (column) => pair.fields.find((f) => f.id === column.fieldId)?.name,
      ),
      ["a", "b"],
    );
  });

  it("folds an inline enum back into the field", () => {
    const diagram = parseDBML(`Table t {
  id integer [pk]
  state state_active_inactive_t
}

enum state_active_inactive_t {
  active
  inactive
}
`);
    const t = tableByName(diagram, "t");
    const state = t.fields.find((f) => f.name === "state");

    assert.equal(state?.fieldType.type, "ENUM");
    assert.deepEqual(state?.values, ["active", "inactive"]);
    assert.equal(diagram.enums.length, 0);
  });

  it("throws a DBMLParseError for invalid source", () => {
    assert.throws(() => parseDBML("Table broken {"), DBMLParseError);
  });
});

describe("exportDBML", () => {
  it("exports tables, enums and references", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const dbml = exportDBML(diagram);

    assert.match(dbml, /enum user_status \{/);
    assert.match(dbml, /Table users \[headercolor: #175e7a\] \{/);
    assert.match(dbml, /email varchar\(255\) \[ not null, unique \]/);
    assert.match(dbml, /Ref fk_posts_user \{/);
    assert.match(dbml, /posts\.user_id > users\.id/);
  });

  it("exports the index block", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const dbml = exportDBML(diagram);

    assert.match(dbml, /indexes \{/);
    assert.match(dbml, /\(user_id\) \[ name: 'idx_posts_user' \]/);
  });

  it("skips tables without fields", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    diagram.tables = [
      {
        id: "t1",
        name: "empty",
        x: 0,
        y: 0,
        fields: [],
        logical: { id: "le-t1", name: "empty", attributes: [] },
      },
    ];

    assert.equal(exportDBML(diagram).trim(), "");
  });

  it("round-trips a diagram through DBML", () => {
    const diagram = parseDBML(SAMPLE_DBML);
    const reparsed = parseDBML(exportDBML(diagram));

    assert.equal(reparsed.tables.length, 2);
    assert.equal(reparsed.relationships.length, 1);
    assert.equal(reparsed.relationships[0].name, "fk_posts_user");
    assert.equal(
      tableByName(reparsed, "posts").fields.find((f) => f.name === "title")
        ?.notNull,
      true,
    );
  });
});

describe("diffDBML", () => {
  function baseDiagram(): Diagram {
    return parseDBML(SAMPLE_DBML);
  }

  /** A structural clone that keeps every id, so a diff sees no identity change. */
  function clone(diagram: Diagram): Diagram {
    return structuredClone(diagram);
  }

  it("returns no operations for identical diagrams", () => {
    const diagram = baseDiagram();
    assert.deepEqual(diffDBML(diagram, clone(diagram)), []);
  });

  it("reports a created table", () => {
    const before = baseDiagram();
    const after = clone(before);
    after.tables.push({
      id: "new",
      name: "comments",
      x: 0,
      y: 0,
      fields: [],
      logical: { id: "le-new", name: "comments", attributes: [] },
    });

    const ops = diffDBML(before, after);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].target, "table");
    assert.equal(ops[0].action, "create");
  });

  it("reports a deleted table", () => {
    const before = baseDiagram();
    const after = clone(before);
    after.tables = after.tables.filter((t) => t.name !== "posts");

    const ops = diffDBML(before, after);
    const deletes = ops.filter(
      (op) => op.target === "table" && op.action === "delete",
    );
    assert.equal(deletes.length, 1);
  });

  it("reports an updated field", () => {
    const before = baseDiagram();
    const after = clone(before);
    const users = tableByName(after, "users");
    users.fields.find((f) => f.name === "email")!.notNull = false;

    const ops = diffDBML(before, after);
    const fieldOps = ops.filter((op) => op.target === "field");
    assert.equal(fieldOps.length, 1);
    assert.deepEqual(fieldOps[0].values, { notNull: false });
  });

  it("replaces the whole field list when the field shape changes", () => {
    const before = baseDiagram();
    const after = clone(before);
    const users = tableByName(after, "users");
    users.fields = users.fields.slice(0, 2);

    const ops = diffDBML(before, after);
    const tableOps = ops.filter(
      (op) => op.target === "table" && op.action === "update",
    );
    assert.equal(tableOps.length, 1);
    assert.ok(Array.isArray(tableOps[0].values.fields));
  });

  it("reports enum changes", () => {
    const before = baseDiagram();
    const after = clone(before);
    after.enums = [];

    const ops = diffDBML(before, after);
    assert.equal(ops[0].target, "enums");
    assert.equal(ops[0].action, "update");
  });
});
