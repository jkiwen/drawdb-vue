import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diagramScopeOf, scopeWithDiagram } from "./diagram-scope.ts";
import { emptyTypeScope, findDomainInScope, resolveType } from "./resolve.ts";
import type { LogicalDomain } from "../models/domain.ts";

function domain(name: string, id = `domain_${name}`): LogicalDomain {
  return { id, name, family: "string", params: { length: 32 }, physical: { oraclesql: { type: "VARCHAR2", params: { length: 32 } } } };
}

describe("diagramScopeOf", () => {
  it("keys the domains of the diagram by their id", () => {
    const layer = diagramScopeOf({ domains: [domain("_ID"), domain("_Group")] });
    assert.deepEqual(Object.keys(layer.domains ?? {}), ["domain__ID", "domain__Group"]);
  });

  it("has no layer for a diagram without domains", () => {
    assert.deepEqual(diagramScopeOf(undefined), {});
    assert.deepEqual(diagramScopeOf({ domains: [] }), {});
  });

  it("drops a domain that has no name", () => {
    const nameless = { ...domain("x"), id: "domain_x", name: "" };
    assert.deepEqual(diagramScopeOf({ domains: [nameless] }), {});
  });
});

describe("scopeWithDiagram", () => {
  it("keeps the layers as they are and adds the diagram layer", () => {
    const scope = scopeWithDiagram(emptyTypeScope(), { domains: [domain("_ID")] });
    assert.deepEqual(Object.keys(scope.diagram.domains ?? {}), ["domain__ID"]);
    assert.deepEqual(scope.application, emptyTypeScope().application);
    assert.deepEqual(scope.workspace, emptyTypeScope().workspace);
  });

  it("resolves an attribute typed by a domain of the diagram", () => {
    const scope = scopeWithDiagram(emptyTypeScope(), { domains: [domain("_ID")] });
    const attribute = {
      id: "a1",
      name: "消息通道ID",
      fieldId: "f1",
      logicalType: { domainId: "domain__ID" },
    };
    const result = resolveType(attribute, "oraclesql", scope);
    assert.equal(result.unmapped, false);
    assert.equal(result.family, "string");
    assert.equal(result.suggested?.type, "VARCHAR2");
    assert.equal(result.suggested?.length, 32);
    assert.deepEqual(result.diagnostics, []);
  });

  it("resolves a domain of the diagram by its name as well as by its id", () => {
    const scope = scopeWithDiagram(emptyTypeScope(), {
      domains: [domain("Amount", "d2")],
    });
    // The attribute may name the domain by its id or by its name.
    assert.equal(findDomainInScope(scope, "d2")?.name, "Amount");
    assert.equal(findDomainInScope(scope, "Amount")?.id, "d2");
  });

  it("lets a domain of the diagram shadow a scope domain of the same name", () => {
    const scope = scopeWithDiagram(
      {
        ...emptyTypeScope(),
        workspace: {
          domains: { Amount: { id: "d1", name: "Amount", family: "integer" } },
        },
      },
      { domains: [domain("Amount", "d2")] },
    );
    // The diagram is the closest layer, so its domain wins.
    assert.equal(findDomainInScope(scope, "Amount")?.id, "d2");
    // The scope domain is still reachable through its own id.
    assert.equal(findDomainInScope(scope, "d1")?.id, "d1");
  });

  it("returns the snapshot itself when the diagram has no domains", () => {
    const scope = emptyTypeScope();
    assert.equal(scopeWithDiagram(scope, undefined), scope);
    assert.equal(scopeWithDiagram(scope, { domains: [] }), scope);
  });
});
