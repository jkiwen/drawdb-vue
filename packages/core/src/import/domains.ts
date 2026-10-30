import type { DatabaseType } from "../models/diagram.ts";
import type { LogicalDomain, PhysicalDomainSpec } from "../models/domain.ts";
import type { TypeParams } from "../types/family.ts";

/** One domain that was already on the diagram and one the import brought. */
export interface DomainMergeNote {
  /** The shared name of the two domains. */
  name: string;
  /** The dialects the two sides both described; the diagram's own wins. */
  replaced: DatabaseType[];
  /** The dialects only the import described; they are added to the domain. */
  added: DatabaseType[];
  /** True when the two sides disagreed on the logical family. */
  familyKept: boolean;
  /** True when the two sides disagreed on the logical parameters. */
  paramsKept: boolean;
}

export interface DomainMergeResult {
  /** The domains of the merged diagram, the diagram's own first. */
  domains: LogicalDomain[];
  /** Incoming domain id → the id it has after the merge. */
  idMap: Map<string, string>;
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

function mergePhysical(
  mine: Partial<Record<DatabaseType, PhysicalDomainSpec>> | undefined,
  theirs: Partial<Record<DatabaseType, PhysicalDomainSpec>> | undefined,
): { physical: Partial<Record<DatabaseType, PhysicalDomainSpec>> | undefined; replaced: DatabaseType[]; added: DatabaseType[] } {
  const replaced: DatabaseType[] = [];
  const added: DatabaseType[] = [];
  if (theirs === undefined) return { physical: mine, replaced, added };
  const merged: Partial<Record<DatabaseType, PhysicalDomainSpec>> = { ...theirs };
  for (const [database, spec] of Object.entries(mine ?? {}) as [DatabaseType, PhysicalDomainSpec][]) {
    merged[database] = spec;
    if (theirs[database] !== undefined) replaced.push(database);
  }
  for (const database of Object.keys(theirs) as DatabaseType[]) {
    if (mine?.[database] === undefined) added.push(database);
  }
  return { physical: merged, replaced, added };
}

/**
 * Folds the domains an import brings into the domains the diagram already
 * declares (review ruling, 2026-10-30: a name that both sides use is merged
 * inside the domain instead of being picked or renamed).
 *
 * The merge is deterministic and never loses a mapping: the physical spec is
 * united per dialect (the diagram's own wins where both state one, and the
 * dialect is named in the note), the logical family and parameters stay the
 * diagram's own when the two sides disagree (a type the diagram already uses
 * must not change meaning under an import), and the incoming attributes are
 * repointed at the merged domain through `idMap`.
 */
export function mergeDiagramDomains(
  mine: readonly LogicalDomain[],
  theirs: readonly LogicalDomain[],
): DomainMergeResult {
  const domains: LogicalDomain[] = [...mine];
  const byName = new Map(domains.map((domain) => [domain.name, domain]));
  const idMap = new Map<string, string>();
  const notes: DomainMergeNote[] = [];

  for (const domain of theirs) {
    const existing = byName.get(domain.name);
    if (existing === undefined) {
      domains.push(domain);
      byName.set(domain.name, domain);
      idMap.set(domain.id, domain.id);
      continue;
    }
    const { physical, replaced, added } = mergePhysical(existing.physical, domain.physical);
    const familyKept = existing.family !== domain.family;
    // Only a disagreement counts: an import that states no parameters says
    // nothing about them, so the diagram's own are not "kept against" it.
    const paramsKept =
      existing.params !== undefined &&
      domain.params !== undefined &&
      !sameParams(existing.params, domain.params);
    const merged: LogicalDomain = {
      ...existing,
      // A domain of the diagram that carried no parameters may take the ones
      // the import states; anything the diagram states is kept as it is.
      ...(existing.params === undefined && domain.params !== undefined ? { params: domain.params } : {}),
      ...(physical === undefined ? {} : { physical }),
    };
    const index = domains.findIndex((candidate) => candidate === existing);
    domains[index] = merged;
    byName.set(merged.name, merged);
    idMap.set(domain.id, merged.id);
    if (replaced.length > 0 || added.length > 0 || familyKept || paramsKept) {
      notes.push({ name: merged.name, replaced, added, familyKept, paramsKept });
    }
  }

  return { domains, idMap, notes };
}
