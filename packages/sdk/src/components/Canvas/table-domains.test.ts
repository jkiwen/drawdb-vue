import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTypeScope } from "@drawdb/core";
import type { LogicalDomain, TypeScopeSnapshot } from "@drawdb/core";
import { domainsByIdentity } from "./table-domains.ts";

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

describe("the domains a canvas label resolves", () => {
  it("keys a scope domain by its id and by its name", () => {
    const map = domainsByIdentity(snapshotWith([domain("d1", "UnicodeString")]));
    assert.equal(map.d1.name, "UnicodeString");
    assert.equal(map.UnicodeString.id, "d1");
  });

  it("lets the diagram layer win over a scope of the same name", () => {
    const map = domainsByIdentity(snapshotWith([domain("d1", "Amount")]), [
      domain("d2", "Amount", "decimal"),
    ]);
    // The closest layer to the attribute is the diagram, the way the resolver
    // reads them.
    assert.equal(map.Amount.id, "d2");
    assert.equal(map.Amount.family, "decimal");
    assert.equal(map.d1.name, "Amount");
  });

  it("lets the workspace layer win over the application layer", () => {
    const map = domainsByIdentity(
      snapshotWith([domain("d1", "Amount", "integer")], [domain("d2", "Amount")]),
    );
    assert.equal(map.Amount.id, "d2");
  });

  it("skips a diagram domain without a name", () => {
    const map = domainsByIdentity(emptyTypeScope(), [domain("d1", "")]);
    assert.deepEqual(map, {});
  });
});
