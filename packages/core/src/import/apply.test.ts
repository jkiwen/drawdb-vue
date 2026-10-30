import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyImport } from "./apply.ts";
import type { ImportSource } from "./types.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { createTable } from "../models/invariants.ts";

function field(id: string, name: string, type = "int"): Table["fields"][number] {
  return { id, name, fieldType: { type }, fieldTypeSource: "imported" };
}

function table(name: string, fields: Table["fields"] = [], extra: Partial<Table> = {}): Table {
  return { ...createTable({ id: `t_${name}`, name }), fields, ...extra };
}

function diagram(tables: Table[] = [], extra: Partial<Diagram> = {}): Diagram {
  return { ...createEmptyDiagram(), tables, ...extra };
}

function source(diagramValue: Diagram): ImportSource {
  return { format: "json", database: diagramValue.database, bytes: 1, diagram: diagramValue, issues: [] };
}

describe("applyImport", () => {
  it("keeps the ids of the diagram and gives every imported object a new one", () => {
    const incoming = diagram([table("users", [field("f_id", "id")]), table("posts", [field("f_user", "user_id")])], {
      relationships: [
        {
          id: "r1",
          name: "fk_posts_user",
          startTableId: "t_posts",
          startFieldId: "f_user",
          endTableId: "t_users",
          endFieldId: "f_id",
        },
      ],
    });
    const target = diagram([table("existing", [field("f_x", "id")], { id: "keep-me" })]);
    const result = applyImport(target, source(incoming), { target: "current" });
    assert.equal(result.applied, true);
    assert.equal(result.diagram.tables.length, 3);
    assert.ok(result.diagram.tables.some((item) => String(item.id) === "keep-me"));
    const imported = result.diagram.tables.filter((item) => String(item.id) !== "keep-me");
    assert.deepEqual(
      imported.map((item) => item.name).sort(),
      ["posts", "users"],
    );
    for (const item of imported) {
      assert.ok(String(item.id) !== "t_users" && String(item.id) !== "t_posts");
    }
  });

  it("re-points the keys, the indexes and the foreign keys at the new ids", () => {
    const incoming = diagram([
      table("users", [field("f_id", "id"), field("f_email", "email")], {
        primaryKey: { id: "pk", logicalName: "pk_users", name: "PK_users", columns: [{ fieldId: "f_id" }] },
        uniqueKeys: [{ id: "uk", logicalName: "uk_email", name: "UK_users_email", columns: [{ fieldId: "f_email" }] }],
        indices: [{ id: "ix", name: "Idx_users_email", unique: false, columns: [{ fieldId: "f_email", order: "desc" }] }],
        foreignKeys: [{ id: "fk", logicalName: "fk_org", name: "FK_users_org", relationshipId: "r1" }],
      }),
      table("orgs", [field("f_org", "id")]),
    ], {
      relationships: [
        {
          id: "r1",
          name: "fk_users_org",
          startTableId: "t_users",
          startFieldId: "f_id",
          endTableId: "t_orgs",
          endFieldId: "f_org",
        },
      ],
    });
    const result = applyImport(diagram(), source(incoming), { target: "current" });
    assert.equal(result.applied, true);
    const users = result.diagram.tables.find((item) => item.name === "users")!;
    const orgs = result.diagram.tables.find((item) => item.name === "orgs")!;
    assert.ok(users.fields.every((item) => !["f_id", "f_email"].includes(String(item.id))));
    assert.equal(String(users.primaryKey!.columns[0]!.fieldId), String(users.fields[0]!.id));
    assert.equal(String(users.uniqueKeys![0]!.columns[0]!.fieldId), String(users.fields[1]!.id));
    assert.equal(String(users.indices![0]!.columns[0]!.fieldId), String(users.fields[1]!.id));
    const relationship = result.diagram.relationships[0]!;
    assert.equal(String(relationship.startTableId), String(users.id));
    assert.equal(String(relationship.endTableId), String(orgs.id));
    assert.equal(String(relationship.startFieldId), String(users.fields[0]!.id));
    assert.equal(String(users.foreignKeys![0]!.relationshipId), String(relationship.id));
  });

  it("folds a merged table into the one the diagram keeps and leaves its primary key", () => {
    const incoming = diagram([
      table("users", [field("f_id", "id"), field("f_new", "nickname")], {
        primaryKey: { id: "pk2", logicalName: "pk_users", name: "PK_users", columns: [{ fieldId: "f_id" }] },
      }),
    ]);
    const target = diagram([
      table("users", [field("mine_id", "id")], {
        primaryKey: { id: "pk1", logicalName: "pk_users", name: "PK_users", columns: [{ fieldId: "mine_id" }] },
      }),
    ]);
    const result = applyImport(target, source(incoming), {
      target: "current",
      conflicts: [{ id: "table:users", action: "merge" }],
    });
    assert.equal(result.applied, true);
    const users = result.diagram.tables.find((item) => item.name === "users")!;
    assert.equal(result.diagram.tables.length, 1);
    assert.deepEqual(
      users.fields.map((item) => item.name),
      ["id", "nickname"],
    );
    assert.equal(users.primaryKey!.name, "PK_users");
    assert.equal(String(users.primaryKey!.columns[0]!.fieldId), "mine_id");
  });

  it("imports a renamed table under a free name", () => {
    const incoming = diagram([table("users", [field("f_id", "id")])]);
    const target = diagram([table("users", [field("mine_id", "id")])]);
    const result = applyImport(target, source(incoming), {
      target: "current",
      conflicts: [{ id: "table:users", action: "rename" }],
    });
    assert.equal(result.applied, true);
    assert.deepEqual(
      result.diagram.tables.map((item) => item.name).sort(),
      ["users", "users_2"],
    );
  });

  it("skips a note the user left alone and renames the one they renamed", () => {
    const incoming = diagram([], {
      notes: [
        { id: "n1", x: 0, y: 0, title: "Rules", content: "" },
        { id: "n2", x: 0, y: 0, title: "Readme", content: "" },
      ],
    });
    const target = diagram([], {
      notes: [
        { id: "mine", x: 0, y: 0, title: "rules", content: "" },
        { id: "mine2", x: 0, y: 0, title: "readme", content: "" },
      ],
    });
    const result = applyImport(target, source(incoming), {
      target: "current",
      conflicts: [
        { id: "note:rules", action: "skip" },
        { id: "note:readme", action: "rename" },
      ],
    });
    assert.equal(result.applied, true);
    assert.deepEqual(
      result.diagram.notes.map((item) => item.title).sort(),
      ["Readme_2", "readme", "rules"],
    );
  });

  it("takes the domain ruling into the merged document", () => {
    const incoming = diagram([], {
      domains: [{ id: "d2", name: "_ID", family: "integer", params: { length: 64 } }],
    });
    const target = diagram([], {
      domains: [{ id: "d1", name: "_ID", family: "string", params: { length: 32 } }],
    });
    const result = applyImport(target, source(incoming), {
      target: "current",
      domains: [
        { name: "_ID", kind: "family", side: "theirs" },
        { name: "_ID", kind: "params", side: "theirs" },
      ],
    });
    assert.equal(result.applied, true);
    assert.equal(result.diagram.domains![0]!.family, "integer");
  });

  it("leaves the diagram alone when the plan is not ready", () => {
    const target = diagram([table("users", [field("mine", "id")])]);
    const result = applyImport(target, source(diagram([table("users")])), {});
    assert.equal(result.applied, false);
    assert.equal(result.diagram, target);
    assert.equal(result.issues[0]!.code, "import.not_ready");
  });
});
