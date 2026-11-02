import { findDomainInScope, scopeWithDiagram } from "@drawdb/core";
import type { Diagram, LogicalDomain, TypeScopeSnapshot } from "@drawdb/core";

/**
 * The lookup of a domain by its id or by its name.
 *
 * The canvas draws the logical type of an attribute as the name of its
 * domain, and the reference carries a `domainId`. The domain itself lives in
 * one of the three layers of the type scope — the application, the workspace,
 * or the diagram's own `diagram.domains` (an imported erwin model carries
 * its custom types there).
 */
export type DomainLookup = (key: string) => LogicalDomain | undefined;

/**
 * The lookup the canvas labels a logical type with.
 *
 * It is the rule of the core, not a second one: the diagram's own domains
 * are laid into the diagram layer of the scope (the closest layer to the
 * attribute that names one), and a domain is found by its name or by its id.
 * The dialect lint resolves through the same rule, so a domain the lint
 * knows is the domain the canvas prints, and a name never shadows the id of
 * another domain.
 */
export function domainLookup(
  snapshot: TypeScopeSnapshot,
  diagram: Pick<Diagram, "domains"> | undefined,
): DomainLookup {
  const scope = scopeWithDiagram(snapshot, diagram);
  return (key: string) => findDomainInScope(scope, key);
}
