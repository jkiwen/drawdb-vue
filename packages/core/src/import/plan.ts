import type { Diagram } from "../models/diagram.ts";
import type { DomainConflict, DomainDecision } from "./domains.ts";
import { mergeDiagramDomains } from "./domains.ts";
import { countDiagram } from "./source.ts";
import type { ImportCounts, ImportFormat, ImportIssue, ImportSource } from "./types.ts";
import { blockingIssues, validateImport } from "./validate.ts";

/** Where an import lands. */
export type ImportTargetKind = "new" | "current" | "replace";

/** Whether the plan may run. */
export type ImportStatus = "ready" | "blocked";

/** How much the diagram an import lands on already holds. */
export interface ImportTargetSummary {
  kind: "empty" | "occupied" | "readonly";
  counts: ImportCounts;
  /**
   * The target worth suggesting. An empty diagram has one (import into it);
   * an occupied one has none, because both answers cost something and the
   * ruling leaves that choice to the user.
   */
  recommended?: ImportTargetKind;
}

/** The kinds of object two diagrams can both hold. */
export type ImportConflictKind = "table" | "field" | "key" | "relationship" | "note" | "area";

/** What the user may do about one conflict. There is no default. */
export type ConflictAction = "skip" | "rename" | "merge" | "replace";

/** One object the diagram already holds that the import also brings. */
export interface ImportConflict {
  /** Stable id the decision points at (`table:users`, `field:users.id`). */
  id: string;
  kind: ImportConflictKind;
  /** Readable location of the incoming object. */
  path: string;
  /** The name the two sides share. */
  name: string;
  /** What differs, when the conflict is about a value. */
  detail?: string;
  /** The answers offered. There is no default (review ruling Q1). */
  choices: ConflictAction[];
}

/** The user's answer to one conflict. */
export interface ConflictDecision {
  id: string;
  action: ConflictAction;
}

/** What the user has settled before the plan can run. */
export interface ImportPlanDecisions {
  /** Where the import lands; omitted means the plan stays blocked on an occupied target. */
  target?: ImportTargetKind;
  /** The answers to the conflicts; a conflict without one keeps the plan blocked. */
  conflicts?: readonly ConflictDecision[];
  /** The answers to the domain conflicts. */
  domains?: readonly DomainDecision[];
  /** The incoming table ids to import; omitted means all of them. */
  tables?: readonly string[];
  /** Register the imported domains in the app type scope (ruling Q3: opt-in). */
  registerDomains?: boolean;
  /** Import what can be imported instead of stopping at blocking issues. */
  repair?: boolean;
}

/** What an import would change. */
export interface ImportPlan {
  status: ImportStatus;
  format: ImportFormat;
  target: ImportTargetSummary;
  targetKind?: ImportTargetKind;
  /** What the file holds. */
  source: ImportCounts;
  /** What would be added to the target. */
  adds: ImportCounts;
  /** Errors block, warnings and info are shown. */
  issues: ImportIssue[];
  /** The issues that block the plan. */
  blocking: ImportIssue[];
  /** The objects that clash; each needs a decision before the plan runs. */
  conflicts: ImportConflict[];
  /** The domain conflicts the user still has to rule on. */
  domainConflicts: DomainConflict[];
  /** What the plan can settle on its own, for the report. */
  notes: ImportIssue[];
  /** Incoming table ids that would be imported, and the ones the user left out. */
  tables: string[];
  skippedTables: string[];
}

function normalized(name: string): string {
  return name.trim().toLowerCase();
}

function fieldSpec(field: {
  fieldType: { type: string; length?: number; precision?: number; scale?: number };
}): string {
  const spec = field.fieldType;
  const params = [spec.length, spec.precision, spec.scale].filter((value) => value !== undefined);
  return `${spec.type}${params.length === 0 ? "" : `(${params.join(",")})`}`;
}

function tableFields(table: Diagram["tables"][number]): Map<string, string> {
  const map = new Map<string, string>();
  for (const field of table.fields) {
    map.set(normalized(field.name), fieldSpec(field));
  }
  return map;
}

function keyNames(table: Diagram["tables"][number]): string[] {
  const names: string[] = [];
  if (table.primaryKey !== undefined) names.push(table.primaryKey.name);
  for (const unique of table.uniqueKeys ?? []) names.push(unique.name);
  for (const index of table.indices ?? []) names.push(index.name);
  return names;
}

function relationshipSignature(
  diagram: Diagram,
  relationship: Diagram["relationships"][number],
): string {
  const child = diagram.tables.find((table) => String(table.id) === String(relationship.startTableId));
  const parent = diagram.tables.find((table) => String(table.id) === String(relationship.endTableId));
  const childField = child?.fields.find((field) => String(field.id) === String(relationship.startFieldId));
  const parentField = parent?.fields.find((field) => String(field.id) === String(relationship.endFieldId));
  return [
    normalized(child?.name ?? String(relationship.startTableId)),
    normalized(childField?.name ?? ""),
    normalized(parent?.name ?? String(relationship.endTableId)),
    normalized(parentField?.name ?? ""),
  ].join("→");
}

/** The objects two diagrams both hold; every one of them is the user's to settle. */
export function importConflicts(source: Diagram, target: Diagram): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const existingTables = new Map(target.tables.map((table) => [normalized(table.name), table]));

  for (const table of source.tables) {
    const existing = existingTables.get(normalized(table.name));
    if (existing === undefined) continue;
    conflicts.push({
      id: `table:${normalized(table.name)}`,
      kind: "table",
      path: `Table[${table.name}]`,
      name: table.name,
      choices: ["skip", "rename", "merge"],
    });

    const mine = tableFields(existing);
    for (const field of table.fields) {
      const other = mine.get(normalized(field.name));
      const incoming = fieldSpec(field);
      if (other === undefined || other === incoming) continue;
      conflicts.push({
        id: `field:${normalized(table.name)}.${normalized(field.name)}`,
        kind: "field",
        path: `Table[${table.name}]/Column[${field.name}]`,
        name: `${table.name}.${field.name}`,
        detail: `${other} vs ${incoming}`,
        choices: ["skip", "merge", "replace"],
      });
    }
  }

  const existingKeys = new Map<string, string>();
  for (const table of target.tables) {
    for (const name of keyNames(table)) existingKeys.set(normalized(name), table.name);
  }
  for (const table of source.tables) {
    for (const name of keyNames(table)) {
      const owner = existingKeys.get(normalized(name));
      if (owner === undefined) continue;
      conflicts.push({
        id: `key:${normalized(name)}`,
        kind: "key",
        path: `Table[${table.name}]/Key[${name}]`,
        name,
        detail: `already on ${owner}`,
        choices: ["skip", "rename"],
      });
    }
  }

  const existingRelationships = new Set(
    target.relationships.map((relationship) => relationshipSignature(target, relationship)),
  );
  for (const relationship of source.relationships) {
    const signature = relationshipSignature(source, relationship);
    if (!existingRelationships.has(signature)) continue;
    conflicts.push({
      id: `relationship:${signature}`,
      kind: "relationship",
      path: "Relationship",
      name: relationship.name ?? signature,
      detail: signature,
      choices: ["skip", "replace"],
    });
  }

  for (const note of source.notes) {
    if (!target.notes.some((other) => normalized(other.title) === normalized(note.title))) continue;
    conflicts.push({
      id: `note:${normalized(note.title)}`,
      kind: "note",
      path: `Note[${note.title}]`,
      name: note.title,
      choices: ["skip", "rename"],
    });
  }

  for (const area of source.areas ?? []) {
    if (!(target.areas ?? []).some((other) => normalized(other.name) === normalized(area.name))) continue;
    conflicts.push({
      id: `area:${normalized(area.name)}`,
      kind: "area",
      path: `Area[${area.name}]`,
      name: area.name,
      choices: ["skip", "rename"],
    });
  }

  return conflicts;
}

/** What a diagram holds, as the target step shows it. */
export function summarizeTarget(
  target: Diagram | null | undefined,
  readonly = false,
): ImportTargetSummary {
  const counts = countDiagram(target ?? null);
  const empty =
    counts.tables === 0 &&
    counts.notes === 0 &&
    counts.areas === 0 &&
    (target?.views.length ?? 0) === 0 &&
    (target?.enums.length ?? 0) === 0 &&
    (target?.types.length ?? 0) === 0;
  return {
    kind: readonly ? "readonly" : empty ? "empty" : "occupied",
    counts,
    ...(empty && !readonly ? { recommended: "current" as ImportTargetKind } : {}),
  };
}

function info(code: string, path: string, message: string): ImportIssue {
  return { level: "info", code, path, message };
}

/**
 * Plans an import: what the file holds, what the target already holds, what
 * clashes, and what still waits for the user. The plan never decides a
 * conflict — it stays `blocked` until every clash carries a `ConflictDecision`
 * and every domain clash a `DomainDecision` (ruling Q1: no defaults).
 */
export function planImport(
  source: ImportSource,
  target: Diagram | null | undefined,
  decisions: ImportPlanDecisions = {},
  options: { readonly?: boolean } = {},
): ImportPlan {
  const issues = validateImport(source);
  const blocking = decisions.repair === true ? [] : blockingIssues(issues);
  const summary = summarizeTarget(target, options.readonly === true);
  const incoming = source.diagram;
  const domains = mergeDiagramDomains(
    target?.domains ?? [],
    incoming?.domains ?? [],
    decisions.domains ?? [],
  );
  const counted = countDiagram(incoming);

  const conflicts =
    incoming !== null && target !== null && target !== undefined
      ? importConflicts(incoming, target)
      : [];
  const decided = new Set((decisions.conflicts ?? []).map((entry) => entry.id));
  const undecided = conflicts.filter((conflict) => !decided.has(conflict.id));

  const chosen = decisions.tables === undefined ? undefined : new Set(decisions.tables.map(String));
  const tables = (incoming?.tables ?? []).filter(
    (table) => chosen === undefined || chosen.has(String(table.id)),
  );
  const skippedTables = (incoming?.tables ?? [])
    .filter((table) => chosen !== undefined && !chosen.has(String(table.id)))
    .map((table) => String(table.id));
  const kept = new Set(tables.map((table) => String(table.id)));

  const notes: ImportIssue[] = [];
  let relationships = 0;
  for (const relationship of incoming?.relationships ?? []) {
    if (!kept.has(String(relationship.startTableId)) || !kept.has(String(relationship.endTableId))) {
      notes.push(
        info(
          "import.relationship_unselected",
          "Relationship",
          "A relationship of an unselected table is not imported.",
        ),
      );
      continue;
    }
    relationships += 1;
  }

  const adds: ImportCounts = {
    tables: tables.length,
    fields: tables.reduce((total, table) => total + table.fields.length, 0),
    keys: tables.reduce((total, table) => total + keyNames(table).length, 0),
    relationships,
    domains: domains.domains.length - (target?.domains?.length ?? 0),
    notes: incoming?.notes.length ?? 0,
    areas: incoming?.areas?.length ?? 0,
  };

  const blocked =
    incoming === null ||
    blocking.length > 0 ||
    undecided.length > 0 ||
    domains.undecided.length > 0 ||
    (decisions.target === undefined && summary.kind === "occupied");

  return {
    status: blocked ? "blocked" : "ready",
    format: source.format,
    target: summary,
    ...(decisions.target === undefined ? {} : { targetKind: decisions.target }),
    source: counted,
    adds,
    issues,
    blocking,
    conflicts,
    domainConflicts: domains.undecided,
    notes,
    tables: tables.map((table) => String(table.id)),
    skippedTables,
  };
}
