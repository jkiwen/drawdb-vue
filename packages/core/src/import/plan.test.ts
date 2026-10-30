import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planImport, importConflicts, summarizeTarget } from "./plan.ts";
import type { ImportSource } from "./types.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { createTable } from "../models/invariants.ts";

function field(name: string, type: string, length?: number): Table["fields"][number] {
  return {
    id: `f_${name}`,
    name,
    fieldType: length === undefined ? { type } : { type, length },
    fieldTypeSource: "imported",
  };
}

function table(name: string, fields: Table["fields"] = []): Table {
  return { ...createTable({ id: `t_${name}`, name }), fields };
}

function diagram(tables: Table[] = [], extra: Partial<Diagram> = {}): Diagram {
  return { ...createEmptyDiagram(), tables, ...extra };
}

function source(diagramValue: Diagram | null, issues: ImportSource["issues"] = []): ImportSource {
  return {
    format: "json",
    database: diagramValue?.database ?? "generic",
    bytes: 100,
    diagram: diagramValue,
    issues,
  };
}

describe("summarizeTarget", () => {
  it("recommends the current diagram when it is empty", () => {
    const summary = summarizeTarget(diagram());
    assert.equal(summary.kind, "empty");
    assert.equal(summary.recommended, "current");
  });

  it("recommends nothing when the diagram already holds objects", () => {
    const summary = summarizeTarget(diagram([table("users")]));
    assert.equal(summary.kind, "occupied");
    assert.equal(summary.recommended, undefined);
    assert.equal(summary.counts.tables, 1);
  });

  it("marks a read-only diagram and suggests nothing", () => {
    const summary = summarizeTarget(diagram([table("users")]), true);
    assert.equal(summary.kind, "readonly");
    assert.equal(summary.recommended, undefined);
  });
});

describe("importConflicts", () => {
  it("lists a table both sides hold with the answers and no default", () => {
    const conflicts = importConflicts(diagram([table("Users")]), diagram([table("users")]));
    assert.deepEqual(conflicts.map((entry) => entry.id), ["table:users"]);
    assert.deepEqual(conflicts[0]!.choices, ["skip", "rename", "merge"]);
  });

  it("names the two types of a column they define differently", () => {
    const incoming = diagram([table("users", [field("id", "varchar", 32)])]);
    const target = diagram([table("users", [field("id", "int")])]);
    const conflicts = importConflicts(incoming, target);
    const column = conflicts.find((entry) => entry.kind === "field")!;
    assert.equal(column.id, "field:users.id");
    assert.equal(column.detail, "int vs varchar(32)");
    assert.deepEqual(column.choices, ["skip", "merge", "replace"]);
  });

  it("says nothing about a column the two sides state alike", () => {
    const incoming = diagram([table("users", [field("id", "int")])]);
    const target = diagram([table("users", [field("id", "int")])]);
    assert.deepEqual(
      importConflicts(incoming, target).filter((entry) => entry.kind === "field"),
      [],
    );
  });

  it("lists a key whose physical name is already taken", () => {
    const incoming = diagram([
      { ...table("orders"), uniqueKeys: [{ id: "u1", logicalName: "uk_code", name: "UK_orders_code", columns: [] }] },
    ]);
    const target = diagram([
      { ...table("orders"), uniqueKeys: [{ id: "u2", logicalName: "uk_code", name: "UK_orders_code", columns: [] }] },
    ]);
    const conflicts = importConflicts(incoming, target).filter((entry) => entry.kind === "key");
    assert.deepEqual(conflicts.map((entry) => entry.id), ["key:uk_orders_code"]);
    assert.deepEqual(conflicts[0]!.choices, ["skip", "rename"]);
  });

  it("lists a note and an area that share a name", () => {
    const incoming = diagram([], {
      notes: [{ id: "n1", x: 0, y: 0, title: "Rules", content: "" }],
      areas: [{ id: "a1", name: "Core", x: 0, y: 0, width: 100, height: 100 }],
    });
    const target = diagram([], {
      notes: [{ id: "n2", x: 0, y: 0, title: "rules", content: "" }],
      areas: [{ id: "a2", name: "core", x: 0, y: 0, width: 100, height: 100 }],
    });
    assert.deepEqual(
      importConflicts(incoming, target).map((entry) => entry.kind),
      ["note", "area"],
    );
  });
});

describe("planImport", () => {
  it("is ready for an empty target once the target is chosen", () => {
    const plan = planImport(source(diagram([table("users", [field("id", "int")])])), diagram(), {
      target: "current",
    });
    assert.equal(plan.status, "ready");
    assert.equal(plan.adds.tables, 1);
    assert.equal(plan.adds.fields, 1);
  });

  it("stays blocked on an occupied target until the user says where it lands", () => {
    const plan = planImport(source(diagram([table("users")])), diagram([table("users")]));
    assert.equal(plan.status, "blocked");
    assert.equal(plan.conflicts.length, 1);
    assert.equal(plan.targetKind, undefined);
  });

  it("stays blocked while a conflict has no decision", () => {
    const incoming = diagram([table("users"), table("posts")]);
    const target = diagram([table("users")]);

    const blocked = planImport(source(incoming), target, { target: "current" });
    assert.equal(blocked.status, "blocked");
    assert.deepEqual(blocked.conflicts.map((entry) => entry.id), ["table:users"]);

    const decided = planImport(source(incoming), target, {
      target: "current",
      conflicts: [{ id: "table:users", action: "skip" }],
    });
    assert.equal(decided.status, "ready");
  });

  it("keeps an unselected table out of the additions and records the lost relationship", () => {
    const users = table("users", [field("id", "int")]);
    const posts = table("posts", [field("user_id", "int")]);
    const incoming = diagram([users, posts], {
      relationships: [
        {
          id: "r1",
          name: "fk_posts_user",
          startTableId: posts.id,
          startFieldId: "f_user_id",
          endTableId: users.id,
          endFieldId: "f_id",
        },
      ],
    });
    const plan = planImport(source(incoming), diagram(), {
      target: "current",
      tables: [String(users.id)],
    });
    assert.equal(plan.adds.tables, 1);
    assert.equal(plan.adds.relationships, 0);
    assert.deepEqual(plan.skippedTables, [String(posts.id)]);
    assert.deepEqual(plan.notes.map((entry) => entry.code), ["import.relationship_unselected"]);
  });

  it("blocks a file the validator rejects and lets the repair mode through", () => {
    const issues = [{ level: "error" as const, code: "import.parse_failed", path: "file", message: "bad" }];
    const blocked = planImport(source(null, issues), diagram(), { target: "current" });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.blocking.length, 1);

    const repaired = planImport(source(null, issues), diagram(), { target: "current", repair: true });
    assert.equal(repaired.blocking.length, 0);
  });

  it("blocks on a domain conflict until the user rules on it", () => {
    const mine = diagram([], {
      domains: [{ id: "domain__ID", name: "_ID", family: "string", params: { length: 32 } }],
    });
    const theirs = diagram([], {
      domains: [{ id: "domain__ID", name: "_ID", family: "integer", params: { length: 64 } }],
    });
    const open = planImport(source(theirs), mine, { target: "current" });
    assert.equal(open.status, "blocked");
    assert.deepEqual(open.domainConflicts.map((entry) => entry.kind), ["family", "params"]);

    const ruled = planImport(source(theirs), mine, {
      target: "current",
      domains: [
        { name: "_ID", kind: "family", side: "mine" },
        { name: "_ID", kind: "params", side: "mine" },
      ],
    });
    assert.equal(ruled.status, "ready");
    assert.deepEqual(ruled.domainConflicts, []);
  });
});
