import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ImportCommand } from "./import-command.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { ImportSession } from "../models/import-session.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";

const table: Table = {
  id: "t1",
  name: "users",
  x: 0,
  y: 0,
  fields: [],
  logical: { id: "l1", name: "user", attributes: [] },
} as Table;

const session: ImportSession = {
  id: "import_1",
  startedAt: "2026-10-31T10:00:00.000Z",
  source: { kind: "file", format: "erwin", fileName: "a.xml", bytes: 12 },
  target: { kind: "current", title: "Example" },
  decisions: { conflicts: [], registerDomains: false, keepCoordinates: true },
  counts: { tables: 1, fields: 1, keys: 1, relationships: 0, domains: 0, notes: 0, areas: 0, skipped: 0 },
  entries: [],
  outcome: "applied",
};

describe("the import command", () => {
  it("puts the imported document into the one on screen", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const next: Diagram = {
      ...createEmptyDiagram({ database: "postgres" }),
      title: "Imported",
      tables: [table],
      imports: [session],
    };

    new ImportCommand(diagram, next, "Import erwin").execute();

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0]?.name, "users");
    assert.equal(diagram.database, "postgres");
    assert.equal(diagram.title, "Imported");
    assert.deepEqual(diagram.imports, [session]);
  });

  it("puts everything back on undo, including the import record", () => {
    const diagram = createEmptyDiagram({ database: "mysql", title: "Example" });
    const before = structuredClone(diagram);
    const next: Diagram = {
      ...createEmptyDiagram({ database: "postgres" }),
      tables: [table],
      imports: [session],
    };

    const command = new ImportCommand(diagram, next);
    command.execute();
    command.undo();

    assert.deepEqual(diagram, before);
  });

  it("keeps the document of the command to itself", () => {
    const diagram = createEmptyDiagram({ database: "mysql" });
    const next: Diagram = {
      ...createEmptyDiagram({ database: "postgres" }),
      tables: [table],
    };

    new ImportCommand(diagram, next).execute();
    diagram.tables[0]!.name = "changed";

    assert.equal(next.tables[0]?.name, "users");
  });

  it("says what it did", () => {
    const diagram = createEmptyDiagram();
    assert.equal(new ImportCommand(diagram, diagram, "Import erwin").description, "Import erwin");
    assert.equal(new ImportCommand(diagram, diagram).description, "Import");
  });
});
