import type { Diagram } from "../models/diagram.ts";
import type { LogicalDomain } from "../models/domain.ts";
import type { TypeScopeLayer, TypeScopeSnapshot } from "./resolve.ts";

/**
 * The domains a diagram defines itself (`diagram.domains`). erwin keeps its
 * custom logical types in the model, so an imported diagram carries them; the
 * resolver reads them as the diagram layer of the scope, the closest layer to
 * the attribute that names one (spec section 5).
 */
export function diagramScopeOf(diagram: Pick<Diagram, "domains"> | undefined): TypeScopeLayer {
  const domains: Record<string, LogicalDomain> = {};
  for (const domain of diagram?.domains ?? []) {
    if (domain.name === "") {
      continue;
    }
    // Keyed by id: the attributes of an imported diagram name the domain
    // they were typed by, and that name has to survive a rename of the type.
    domains[domain.id] = domain;
  }
  return Object.keys(domains).length === 0 ? {} : { domains };
}

/**
 * The snapshot with the diagram's own domains laid into its diagram layer.
 * The callers that resolve a type (the panel's suggestion, the dialect lint)
 * go through here so the diagram is never resolved without them.
 */
export function scopeWithDiagram(
  snapshot: TypeScopeSnapshot,
  diagram: Pick<Diagram, "domains"> | undefined,
): TypeScopeSnapshot {
  const layer = diagramScopeOf(diagram);
  if (layer.domains === undefined) {
    return snapshot;
  }
  return {
    ...snapshot,
    diagram: {
      ...snapshot.diagram,
      domains: { ...(snapshot.diagram.domains ?? {}), ...layer.domains },
    },
  };
}
