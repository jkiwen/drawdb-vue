import type { LogicalDomain, TypeScopeSnapshot } from "@drawdb/core";

/**
 * The domains a canvas label can resolve, keyed by id and by name.
 *
 * The canvas draws the logical type of an attribute as the name of its
 * domain; the reference carries a `domainId`, and the domain itself lives in
 * one of the three layers of the type scope — application, workspace, or the
 * diagram's own `diagram.domains` (an imported erwin model carries its
 * custom types there). This merges them in the order the resolver reads
 * them, so the closest layer wins, and keys the result both ways: the older
 * scope layers store their domains by name, the diagram layer by id.
 */
export function domainsByIdentity(
  snapshot: TypeScopeSnapshot,
  diagramDomains: readonly LogicalDomain[] = [],
): Record<string, LogicalDomain> {
  const map: Record<string, LogicalDomain> = {};
  const layers = [snapshot.application, snapshot.workspace, snapshot.diagram];
  for (const layer of layers) {
    for (const domain of Object.values(layer.domains ?? {})) {
      map[domain.id] = domain;
      map[domain.name] = domain;
    }
  }
  for (const domain of diagramDomains) {
    if (domain.name === "") {
      continue;
    }
    map[domain.id] = domain;
    map[domain.name] = domain;
  }
  return map;
}
