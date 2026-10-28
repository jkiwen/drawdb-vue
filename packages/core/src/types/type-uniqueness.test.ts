import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LogicalDomain } from "../models/domain.ts";
import {
  emptyTypeScope,
  registerDomain,
  updateFamilyMapping,
  upsertScopeLayer,
} from "./resolve.ts";

describe("type name uniqueness (Q1, spec section 3.3.1)", () => {
  it("registers a new domain", () => {
    const scope = emptyTypeScope();
    const domain: LogicalDomain = { id: "Money", name: "Money", family: "decimal" };
    const result = registerDomain(scope, "application", domain);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.scope.application.domains?.Money?.name, "Money");
    }
  });

  it("rejects a domain name that collides with a builtin family id", () => {
    const scope = emptyTypeScope();
    const domain: LogicalDomain = { id: "String", name: "String", family: "decimal" };
    const result = registerDomain(scope, "application", domain);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.diagnostic.code, "NAME_CONFLICT");
    }
  });

  it("rejects case-insensitive duplicates with surrounding whitespace", () => {
    let scope = emptyTypeScope();
    const first = registerDomain(scope, "application", {
      id: "Money",
      name: "Money",
      family: "decimal",
    });
    assert.ok(first.ok);
    scope = first.scope;

    const dup = registerDomain(scope, "workspace", {
      id: "money2",
      name: "  money ",
      family: "decimal",
    });
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.diagnostic.code, "NAME_CONFLICT");
    }
  });

  it("rejects a domain name colliding with a custom family", () => {
    let scope = emptyTypeScope();
    const fam = updateFamilyMapping(scope, "application", "geo", "postgres", {
      type: "GEOMETRY",
    });
    assert.ok(fam.ok);
    scope = fam.scope;
    const dup = registerDomain(scope, "application", {
      id: "Geo",
      name: "Geo",
      family: "string",
    });
    assert.equal(dup.ok, false);
  });

  it("never mutates the input scope", () => {
    const scope = emptyTypeScope();
    registerDomain(scope, "application", {
      id: "Money",
      name: "Money",
      family: "decimal",
    });
    assert.equal(scope.application.domains, undefined);
  });
});

describe("updateFamilyMapping (spec section 3.3.1 override granularity)", () => {
  it("overrides only the targeted family + dialect item", () => {
    const scope = emptyTypeScope();
    const result = updateFamilyMapping(scope, "diagram", "string", "mysql", {
      type: "TEXT",
    });
    assert.ok(result.ok);
    const override = result.scope.diagram.families?.string;
    assert.equal(override?.mappings?.mysql?.type, "TEXT");
    // No other dialect touched.
    assert.equal(Object.keys(override?.mappings ?? {}).length, 1);
  });

  it("rejects a custom family id that collides with a domain name", () => {
    const reg = registerDomain(emptyTypeScope(), "application", {
      id: "Money",
      name: "Money",
      family: "decimal",
    });
    assert.ok(reg.ok);
    const fam = updateFamilyMapping(reg.scope, "application", "money", "mysql", {
      type: "DECIMAL",
    });
    assert.equal(fam.ok, false);
    if (!fam.ok) {
      assert.equal(fam.diagnostic.code, "NAME_CONFLICT");
    }
  });
});

describe("upsertScopeLayer", () => {
  it("merges domains into the target layer without dropping existing entries", () => {
    const reg = registerDomain(emptyTypeScope(), "workspace", {
      id: "Money",
      name: "Money",
      family: "decimal",
    });
    assert.ok(reg.ok);
    const merged = upsertScopeLayer(reg.scope, "workspace", {
      families: { string: { defaultParams: { length: 64 } } },
    });
    assert.equal(merged.workspace.domains?.Money?.name, "Money");
    assert.equal(merged.workspace.families?.string?.defaultParams?.length, 64);
  });
});
