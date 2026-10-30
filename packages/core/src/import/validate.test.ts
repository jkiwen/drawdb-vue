import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateImport, blockingIssues, repairMode } from "./validate.ts";
import { buildImportSource } from "./source.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { emptyTypeScope } from "../types/resolve.ts";
import type { Diagram, Table } from "../models/index.ts";

function field(id: string, name: string, type = "INTEGER"): Table["fields"][number] {
  return { id, name, fieldType: { type }, fieldTypeSource: "mapped" };
}

function diagram(extra: Partial<Table> = {}): Diagram {
  const empty = createEmptyDiagram({ database: "mysql" });
  empty.tables = [
    {
      id: "t1",
      name: "users",
      x: 0,
      y: 0,
      fields: [field("f1", "id"), field("f2", "email", "VARCHAR")],
      logical: { id: "l1", name: "users", attributes: [] },
      primaryKey: { id: "pk1", logicalName: "PK_users", name: "PK_users", columns: [{ fieldId: "f1" }] },
      ...extra,
    },
  ];
  return empty;
}

describe("validateImport (P8 task 2)", () => {
  it("passes a good diagram", () => {
    const source = { ...buildImportSource("CREATE TABLE users (id INTEGER PRIMARY KEY);", { format: "sql", database: "mysql" }) };
    const issues = validateImport(source, { scope: emptyTypeScope() });
    assert.deepEqual(
      issues.filter((issue) => issue.level === "error").map((issue) => issue.code),
      [],
    );
  });

  it("reports an index that names a field the table does not have", () => {
    const source = {
      format: "json" as const,
      database: "mysql" as const,
      bytes: 0,
      issues: [],
      diagram: diagram({
        indices: [{ id: "i1", name: "Idx_ghost", unique: false, columns: [{ fieldId: "ghost" }] }],
      }),
    };
    const issues = validateImport(source, { scope: emptyTypeScope() });
    const error = issues.find((issue) => issue.code === "index.unknown_field");
    assert.ok(error);
    assert.equal(error.level, "error");
    assert.match(error.path, /users/);
  });

  it("warns instead of blocking when a table has no primary key", () => {
    const source = {
      format: "json" as const,
      database: "mysql" as const,
      bytes: 0,
      issues: [],
      diagram: diagram({ primaryKey: undefined }),
    };
    const issues = validateImport(source, { scope: emptyTypeScope() });
    const warning = issues.find((issue) => issue.code === "table.no_primary_key");
    assert.ok(warning);
    assert.equal(warning.level, "warning");
    assert.equal(blockingIssues(issues).length, 0);
  });

  it("keeps the parse failure of a source that never became a diagram", () => {
    const source = buildImportSource("not sql", { format: "sql", database: "mysql" });
    const issues = validateImport(source, { scope: emptyTypeScope() });
    assert.equal(blockingIssues(issues).length, 1);
    assert.equal(issues[0]?.level, "error");
  });

  it("turns the blocking issues into the skips of the repair mode", () => {
    const source = {
      format: "json" as const,
      database: "mysql" as const,
      bytes: 0,
      issues: [{ level: "error" as const, code: "import.parse_failed", path: "SQL", message: "nope" }],
      diagram: null,
    };
    const skips = repairMode(source);
    assert.equal(skips.length, 1);
    assert.equal(skips[0]?.reason, "unparsable");
    assert.equal(skips[0]?.path, "SQL");
  });
});
