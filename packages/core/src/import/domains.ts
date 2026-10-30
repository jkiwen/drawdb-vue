import type { DatabaseType } from "../models/diagram.ts";
import type { LogicalDomain, PhysicalDomainSpec } from "../models/domain.ts";
import type { TypeParams } from "../types/family.ts";

/** Which side of a domain the user kept. */
export type DomainSide = "mine" | "theirs";

/** One part of a domain the two diagrams state differently. */
export interface DomainConflict {
  /** The shared name of the two domains. */
  name: string;
  /** The dimension that disagrees. */
  kind: "physical" | "family" | "params";
  /** The dialect, for a physical conflict. */
  database?: DatabaseType;
  /** What the diagram already declares. */
  mine: PhysicalDomainSpec | TypeParams | string | undefined;
  /** What the import declares. */
  theirs: PhysicalDomainSpec | TypeParams | string | undefined;
}

/** The user's ruling on one conflict. */
export interface DomainDecision {
  name: string;
  kind: "physical" | "family" | "params";
  database?: DatabaseType;
  side: DomainSide;
}

/** A part of the merge that needed no ruling, for the report. */
export interface DomainMergeNote {
  /** The shared name of the two domains. */
  name: string;
  /** The dialects only the import described, added to the domain. */
  added: DatabaseType[];
}

export interface DomainMergeResult {
  /** The domains of the merged diagram, the diagram's own first. */
  domains: LogicalDomain[];
  /** Incoming domain id -> the id it has after the merge. */
  idMap: Map<string, string>;
  /** The conflicts the user still has to rule on (empty when the merge may run). */
  undecided: DomainConflict[];
  /** What was merged without asking. */
  notes: DomainMergeNote[];
}

function sameParams(a: TypeParams | undefined, b: TypeParams | undefined): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key as keyof TypeParams] !== right[key as keyof TypeParams]) return false;
  }
  return true;
}

function samePhysical(a: PhysicalDomainSpec | undefined, b: PhysicalDomainSpec | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.type === b.type && a.schema === b.schema && sameParams(a.params, b.params);
}

/**
 * The parts of two same-named domains that disagree. There is no priority rule
 * between the two sides: every entry here is the user's to settle, so a merge
 * that still reports any of them cannot run.
 */
export function domainConflicts(mine: LogicalDomain, theirs: LogicalDomain): DomainConflict[] {
  const conflicts: DomainConflict[] = [];
  if (mine.family !== theirs.family) {
    conflicts.push({ name: theirs.name, kind: "family", mine: mine.family, theirs: theirs.family });
  }
  if (mine.params !== undefined && theirs.params !== undefined && !sameParams(mine.params, theirs.params)) {
    conflicts.push({ name: theirs.name, kind: "params", mine: mine.params, theirs: theirs.params });
  }
  const incoming = Object.entries(theirs.physical ?? {}) as [DatabaseType, PhysicalDomainSpec][];
  for (const [database, spec] of incoming) {
    const other = mine.physical?.[database];
    if (other !== undefined && !samePhysical(other, spec)) {
      conflicts.push({ name: theirs.name, kind: "physical", database, mine: other, theirs: spec });
    }
  }
  return conflicts;
}

/** The side the user picked for one conflict, or undefined when undecided. */
function decisionFor(
  decisions: readonly DomainDecision[],
  name: string,
  kind: DomainDecision["kind"],
  database?: DatabaseType,
): DomainSide | undefined {
  return decisions.find(
    (entry) => entry.name === name && entry.kind === kind && entry.database === database,
  )?.side;
}

/**
 * Folds the domains an import brings into the domains the diagram declares.
 *
 * The parts that agree, or that only one side has, merge on the spot. Every
 * disagreement is returned in `undecided` until the user rules on it with a
 * `DomainDecision`; the caller must not apply the merge while that list is not
 * empty (the wizard's decision step is where it empties).
 */
export function mergeDiagramDomains(
  mine: readonly LogicalDomain[],
  theirs: readonly LogicalDomain[],
  decisions: readonly DomainDecision[] = [],
): DomainMergeResult {
  const domains: LogicalDomain[] = [...mine];
  const byName = new Map(domains.map((domain) => [domain.name, domain]));
  const idMap = new Map<string, string>();
  const undecided: DomainConflict[] = [];
  const notes: DomainMergeNote[] = [];

  for (const domain of theirs) {
    const existing = byName.get(domain.name);
    if (existing === undefined) {
      domains.push(domain);
      byName.set(domain.name, domain);
      idMap.set(domain.id, domain.id);
      continue;
    }

    for (const conflict of domainConflicts(existing, domain)) {
      if (decisionFor(decisions, conflict.name, conflict.kind, conflict.database) === undefined) {
        undecided.push(conflict);
      }
    }

    // The dialects only the import states need no ruling; the rest wait for one.
    const added = (Object.keys(domain.physical ?? {}) as DatabaseType[]).filter(
      (database) => existing.physical?.[database] === undefined,
    );
    const physical: Partial<Record<DatabaseType, PhysicalDomainSpec>> = {
      ...(existing.physical ?? {}),
    };
    for (const database of added) {
      physical[database] = domain.physical?.[database] as PhysicalDomainSpec;
    }
    const incoming = Object.entries(domain.physical ?? {}) as [DatabaseType, PhysicalDomainSpec][];
    for (const [database, spec] of incoming) {
      if (decisionFor(decisions, domain.name, "physical", database) === "theirs") {
        physical[database] = spec;
      }
    }

    const family = decisionFor(decisions, domain.name, "family") === "theirs" ? domain.family : existing.family;
    const params =
      decisionFor(decisions, domain.name, "params") === "theirs"
        ? domain.params
        : existing.params === undefined
          ? domain.params
          : existing.params;

    const merged: LogicalDomain = {
      ...existing,
      family,
      ...(params === undefined ? {} : { params }),
      ...(Object.keys(physical).length === 0 ? {} : { physical }),
    };
    const index = domains.findIndex((candidate) => candidate === existing);
    domains[index] = merged;
    byName.set(merged.name, merged);
    idMap.set(domain.id, merged.id);
    if (added.length > 0) {
      notes.push({ name: merged.name, added });
    }
  }

  return { domains, idMap, undecided, notes };
}
