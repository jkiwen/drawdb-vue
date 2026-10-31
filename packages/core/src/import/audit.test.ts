import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImportSession, diffSessions, subjectOf } from "./audit.ts";
import type { ImportSession } from "../models/import-session.ts";
import type { ImportIssue } from "./types.ts";
import type { ImportPlan } from "./plan.ts";
import type { ImportSource } from "./types.ts";

const issue = (level: ImportIssue["level"], code: string, path: string, message = "x"): ImportIssue => ({
  level,
  code,
  path,
  message,
});

const source = {
  format: "erwin",
  database: "oraclesql",
  fileName: "DEVSV_MessageCenter.xml",
  bytes: 1465128,
  version: "7.3.1822",
  diagram: null,
  issues: [],
} as unknown as ImportSource;

const plan = {
  status: "ready",
  format: "erwin",
  target: { kind: "empty", counts: {} },
  targetKind: "new",
  source: { tables: 22 },
  adds: { tables: 19, fields: 139, keys: 37, relationships: 15, domains: 20, notes: 0, areas: 0, skipped: 6 },
  issues: [],
  blocking: [],
  conflicts: [],
  domainConflicts: [],
  notes: [],
  tables: [],
  skippedTables: [],
} as unknown as ImportPlan;

describe("the record of an import", () => {
  it("keeps where the file came from and what it added", () => {
    const session = createImportSession({
      source,
      plan,
      targetKind: "new",
      targetTitle: "Imported",
      startedAt: "2026-10-31T10:00:00.000Z",
      outcome: "applied",
      counts: { tables: 19, fields: 139, keys: 37, relationships: 15, domains: 20, notes: 0, areas: 0, skipped: 6 },
    });

    assert.equal(session.source.format, "erwin");
    assert.equal(session.source.fileName, "DEVSV_MessageCenter.xml");
    assert.equal(session.source.bytes, 1465128);
    assert.equal(session.source.version, "7.3.1822");
    assert.equal(session.target.kind, "new");
    assert.equal(session.outcome, "applied");
    assert.equal(session.counts.tables, 19);
    assert.ok(session.id.length > 0);
  });

  it("turns the issues of the plan into audit entries", () => {
    const session = createImportSession({
      source,
      plan: { ...plan, issues: [issue("warning", "erwin.asymmetric", "Entity[7]"), issue("info", "import.relationship_unselected", "Relationship")] },
      targetKind: "current",
      targetTitle: "Current",
      startedAt: "2026-10-31T10:00:00.000Z",
      outcome: "applied",
    });

    assert.deepEqual(
      session.entries.map((entry) => [entry.level, entry.code, entry.path]),
      [
        ["warning", "erwin.asymmetric", "Entity[7]"],
        ["info", "import.relationship_unselected", "Relationship"],
      ],
    );
  });

  it("names the object an entry points at", () => {
    assert.deepEqual(subjectOf("Table[users]/Column[id]"), {
      kind: "field",
      name: "users.id",
    });
    assert.deepEqual(subjectOf("Table[users]/Key[PK_users]"), { kind: "key", name: "PK_users" });
    assert.deepEqual(subjectOf("Table[users]"), { kind: "table", name: "users" });
    assert.deepEqual(subjectOf("Relationship"), { kind: "relationship" });
    assert.deepEqual(subjectOf("Domain[_ID]"), { kind: "domain", name: "_ID" });
    assert.equal(subjectOf("Entity[7]"), undefined);
  });

  it("records a failure with its message", () => {
    const session = createImportSession({
      source,
      plan,
      targetKind: "new",
      targetTitle: "Imported",
      startedAt: "2026-10-31T10:00:00.000Z",
      outcome: "failed",
      error: "Out of memory",
    });

    assert.equal(session.outcome, "failed");
    assert.equal(session.error, "Out of memory");
    assert.deepEqual(session.entries, []);
  });

  it("compares an import with the one before it", () => {
    const base = createImportSession({
      source,
      plan: { ...plan, issues: [issue("warning", "erwin.asymmetric", "Entity[7]")] },
      targetKind: "new",
      targetTitle: "Imported",
      startedAt: "2026-10-31T10:00:00.000Z",
      outcome: "applied",
      counts: { tables: 19, fields: 139, keys: 37, relationships: 15, domains: 20, notes: 0, areas: 0, skipped: 6 },
    });
    const next: ImportSession = {
      ...base,
      id: "second",
      counts: { ...base.counts, tables: 21, skipped: 4 },
      entries: [...base.entries, issue("warning", "index.unknown_field", "Table[orders]/Key[Idx_orders]") as never],
    };

    const diff = diffSessions(base, next);
    assert.equal(diff.counts.tables?.before, 19);
    assert.equal(diff.counts.tables?.after, 21);
    assert.equal(diff.counts.tables?.delta, 2);
    assert.equal(diff.counts.fields, undefined);
    assert.deepEqual(diff.addedCodes, ["index.unknown_field"]);
    assert.deepEqual(diff.removedCodes, []);
  });

  it("says nothing changed when the two sessions match", () => {
    const session = createImportSession({
      source,
      plan,
      targetKind: "new",
      targetTitle: "Imported",
      startedAt: "2026-10-31T10:00:00.000Z",
      outcome: "applied",
    });
    const diff = diffSessions(session, session);
    assert.deepEqual(diff.counts, {});
    assert.deepEqual(diff.addedCodes, []);
    assert.deepEqual(diff.removedCodes, []);
  });
});
