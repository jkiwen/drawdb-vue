import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportDiagramJson } from "./export.ts";
import { importDiagramJson } from "./import.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { ImportSession } from "../models/import-session.ts";
import type { Diagram } from "../models/diagram.ts";

const session: ImportSession = {
  id: "import_abc",
  startedAt: "2026-10-31T10:00:00.000Z",
  finishedAt: "2026-10-31T10:00:03.000Z",
  source: { kind: "file", format: "erwin", fileName: "DEVSV_MessageCenter.xml", bytes: 1465128, version: "7.3.1822" },
  target: { kind: "new", title: "Imported" },
  decisions: { conflicts: [{ id: "table:users", action: "rename" }], registerDomains: true, keepCoordinates: true },
  counts: { tables: 19, fields: 139, keys: 37, relationships: 15, domains: 20, notes: 0, areas: 0, skipped: 6 },
  entries: [
    {
      level: "warning",
      code: "erwin.asymmetric",
      path: "Entity[7]",
      message: "The entity carries no attribute.",
    },
  ],
  outcome: "applied",
};

function withSession(diagram: Diagram): Diagram {
  return { ...diagram, imports: [session] };
}

describe("the import history of a diagram", () => {
  it("travels with the document", () => {
    const diagram = withSession(createEmptyDiagram({ title: "Example" }));
    const exported = JSON.parse(exportDiagramJson(diagram)) as { imports?: unknown };

    assert.equal((exported.imports as ImportSession[])[0]?.id, "import_abc");
    assert.equal((exported.imports as ImportSession[])[0]?.source.fileName, "DEVSV_MessageCenter.xml");
  });

  it("comes back unchanged", () => {
    const diagram = withSession(createEmptyDiagram());
    const back = importDiagramJson(exportDiagramJson(diagram));

    assert.deepEqual(back.imports, [session]);
  });

  it("stays absent for a diagram that was never imported into", () => {
    const back = importDiagramJson(exportDiagramJson(createEmptyDiagram()));
    assert.equal(back.imports, undefined);
  });

  it("drops entries that are not sessions", () => {
    const raw = JSON.parse(exportDiagramJson(createEmptyDiagram())) as Record<string, unknown>;
    raw.imports = [{ nope: true }, session];
    const back = importDiagramJson(JSON.stringify(raw));

    assert.deepEqual(back.imports, [session]);
  });
});
