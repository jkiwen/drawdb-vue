import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTypeScope } from "@drawdb/core";
import type { Diagram, LogicalDomain, TypeScopeSnapshot } from "@drawdb/core";
import { domainLookup } from "./table-domains.ts";

function domain(id: string, name: string, family: LogicalDomain["family"] = "string"): LogicalDomain {
  return { id, name, family };
}

function snapshotWith(
  application: LogicalDomain[] = [],
  workspace: LogicalDomain[] = [],
): TypeScopeSnapshot {
  const base = emptyTypeScope();
  return {
    ...base,
    application: {
      ...base.application,
      domains: Object.fromEntries(application.map((entry) => [entry.name, entry])),
    },
    workspace: {
      ...base.workspace,
      domains: Object.fromEntries(workspace.map((entry) => [entry.name, entry])),
    },
  };
}

function diagramWith(domains: LogicalDomain[]): Pick<Diagram, "domains"> {
  return { domains };
}

describe("the domains a canvas label resolves", () => {
  it("finds a scope domain by its name and by its id", () => {
    const lookup = domainLookup(snapshotWith([domain("d1", "UnicodeString")]), undefined);
    assert.equal(lookup("d1")?.name, "UnicodeString");
    assert.equal(lookup("UnicodeString")?.id, "d1");
  });

  it("lets the diagram layer win over a scope domain of the same name", () => {
    const lookup = domainLookup(
      snapshotWith([domain("d1", "Amount", "integer")]),
      diagramWith([domain("d2", "Amount", "decimal")]),
    );
    // The closest layer to the attribute is the diagram, the way the
    // resolver reads them.
    assert.equal(lookup("Amount")?.id, "d2");
    assert.equal(lookup("Amount")?.family, "decimal");
    // The scope domain is still reachable through its own id.
    assert.equal(lookup("d1")?.name, "Amount");
  });

  it("lets the workspace layer win over the application layer", () => {
    const lookup = domainLookup(
      snapshotWith([domain("d1", "Amount", "integer")], [domain("d2", "Amount")]),
      undefined,
    );
    assert.equal(lookup("Amount")?.id, "d2");
  });

  it("skips a diagram domain without a name", () => {
    const lookup = domainLookup(emptyTypeScope(), diagramWith([domain("d1", "")]));
    assert.equal(lookup("d1"), undefined);
  });

  it("never lets a name shadow the id of another domain", () => {
    // The scope keys its domains by their name, the diagram layer by their
    // id. A domain whose name is the id of another one must not take its
    // place: the id answers with its own domain.
    const lookup = domainLookup(
      snapshotWith([domain("d1", "d2")]),
      diagramWith([domain("d2", "UnicodeString")]),
    );
    assert.equal(lookup("d2")?.name, "UnicodeString");
  });

  it("answers with nothing for a domain no layer knows", () => {
    const lookup = domainLookup(emptyTypeScope(), undefined);
    assert.equal(lookup("d_missing"), undefined);
  });
});
