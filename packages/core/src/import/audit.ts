import type { ImportAuditEntry, ImportSession } from "../models/import-session.ts";
import type { ImportPlan } from "./plan.ts";
import type { ImportCounts, ImportIssue, ImportSource } from "./types.ts";

/** The kinds of object an audit path can name. */
const SUBJECT_KINDS = ["table", "field", "key", "relationship", "domain"] as const;

function between(text: string, open: string, close: string): string | undefined {
  const start = text.indexOf(open);
  if (start < 0) return undefined;
  const end = text.indexOf(close, start + open.length);
  if (end < 0) return undefined;
  return text.slice(start + open.length, end);
}

/**
 * The object an audit path points at, so the interface can jump to it.
 *
 * Paths are written by the readers as `Table[users]/Column[id]`; anything the
 * parser does not recognise simply gets no subject rather than a guess.
 */
export function subjectOf(path: string): ImportAuditEntry["subject"] {
  const table = between(path, "Table[", "]");
  const column = between(path, "Column[", "]");
  const key = between(path, "Key[", "]");
  const domain = between(path, "Domain[", "]");
  if (table !== undefined && column !== undefined) return { kind: "field", name: `${table}.${column}` };
  if (key !== undefined) return { kind: "key", name: key };
  if (table !== undefined) return { kind: "table", name: table };
  if (domain !== undefined) return { kind: "domain", name: domain };
  if (path.startsWith("Relationship")) return { kind: "relationship" };
  if (path.startsWith("Domain")) return { kind: "domain" };
  return undefined;
}

function auditEntry(issue: ImportIssue): ImportAuditEntry {
  const subject = subjectOf(issue.path);
  return subject === undefined
    ? { level: issue.level, code: issue.code, path: issue.path, message: issue.message }
    : { level: issue.level, code: issue.code, path: issue.path, message: issue.message, subject };
}

/** The counts an import session records, from the plan it applied. */
export function countsOf(plan: ImportPlan, overrides: Partial<ImportCounts> = {}): ImportSession["counts"] {
  const adds = plan.adds;
  return {
    tables: overrides.tables ?? adds.tables,
    fields: overrides.fields ?? adds.fields,
    keys: overrides.keys ?? adds.keys,
    relationships: overrides.relationships ?? adds.relationships,
    domains: overrides.domains ?? adds.domains,
    notes: overrides.notes ?? adds.notes,
    areas: overrides.areas ?? adds.areas,
    skipped: overrides.skipped ?? adds.skipped ?? 0,
  };
}

export interface CreateImportSessionInput {
  source: ImportSource;
  plan: ImportPlan;
  /** Where the import went: a new diagram or the one that was open. */
  targetKind: "new" | "current";
  targetTitle: string;
  diagramId?: string;
  decisions?: Partial<ImportSession["decisions"]>;
  counts?: Partial<ImportCounts>;
  startedAt: string;
  finishedAt?: string;
  outcome: ImportSession["outcome"];
  error?: string;
}

let sessionCounter = 0;

/**
 * Builds the record of one import (design section 6.1).
 *
 * Everything the report shows comes from here, so a session is written even
 * when the user cancels: `aborted` explains the file was looked at and put
 * aside, which is a decision worth keeping too.
 */
export function createImportSession(input: CreateImportSessionInput): ImportSession {
  sessionCounter += 1;
  const id = `import_${Date.now().toString(36)}_${sessionCounter}`;
  const session: ImportSession = {
    id,
    startedAt: input.startedAt,
    source: {
      kind: input.source.fileName === undefined ? "text" : "file",
      format: input.source.format,
      fileName: input.source.fileName,
      bytes: input.source.bytes,
      version: input.source.version,
    },
    target: { kind: input.targetKind, diagramId: input.diagramId, title: input.targetTitle },
    decisions: {
      conflicts: input.decisions?.conflicts ?? [],
      registerDomains: input.decisions?.registerDomains ?? false,
      keepCoordinates: input.decisions?.keepCoordinates ?? true,
    },
    counts: countsOf(input.plan, input.counts),
    entries: input.outcome === "failed" ? [] : input.plan.issues.map(auditEntry),
    outcome: input.outcome,
  };
  if (input.finishedAt !== undefined) session.finishedAt = input.finishedAt;
  if (input.error !== undefined) session.error = input.error;
  return session;
}

/** What the same file did differently this time (design section 6.3). */
export interface ImportSessionDiff {
  counts: Record<string, { before: number; after: number; delta: number }>;
  addedCodes: string[];
  removedCodes: string[];
}

function codes(entries: ImportAuditEntry[]): string[] {
  return entries.map((entry) => entry.code);
}

function multisetDifference(from: string[], remove: string[]): string[] {
  const left = [...remove];
  const out: string[] = [];
  for (const code of from) {
    const at = left.indexOf(code);
    if (at >= 0) {
      left.splice(at, 1);
      continue;
    }
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Compares two imports of the same file, so the report can say what changed
 * (design section 6.3: the audit is a basis for decisions, not a log).
 */
export function diffSessions(previous: ImportSession, next: ImportSession): ImportSessionDiff {
  const counts: ImportSessionDiff["counts"] = {};
  for (const key of Object.keys(previous.counts) as Array<keyof ImportSession["counts"]>) {
    const before = previous.counts[key];
    const after = next.counts[key];
    if (before === after) continue;
    counts[key] = { before, after, delta: after - before };
  }
  const beforeCodes = codes(previous.entries);
  const afterCodes = codes(next.entries);
  return {
    counts,
    addedCodes: multisetDifference(afterCodes, beforeCodes),
    removedCodes: multisetDifference(beforeCodes, afterCodes),
  };
}

/** Appends a session to the history the diagram carries (design section 6.2). */
export function appendImportSession(
  existing: ImportSession[] | undefined,
  session: ImportSession,
): ImportSession[] {
  return [...(existing ?? []), session];
}

export { SUBJECT_KINDS };
