import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LogicalAttribute } from "../models/logical.ts";
import type { LogicalDomain } from "../models/domain.ts";
import {
  emptyTypeScope,
  resolveType,
  type TypeScopeSnapshot,
} from "./resolve.ts";

function attr(
  logicalType: LogicalAttribute["logicalType"],
  params?: LogicalAttribute["params"],
): LogicalAttribute {
  return { id: "a1", name: "col", logicalType, ...(params ? { params } : {}) };
}

function domain(parts: Partial<LogicalDomain> & { name: string }): LogicalDomain {
  return { id: parts.name, family: "string", ...parts };
}

describe("resolveType parameter priority chain (spec section 4.1)", () => {
  const money: LogicalDomain = domain({
    name: "Money",
    family: "decimal",
    params: { precision: 12, scale: 4 },
  });
  const scope: TypeScopeSnapshot = {
    ...emptyTypeScope(),
    application: { domains: { Money: money } },
  };

  it("attribute params win over domain, family default and mapping params", () => {
    const result = resolveType(
      attr({ domainId: "Money" }, { precision: 20, scale: 6 }),
      "postgres",
      scope,
    );
    assert.equal(result.suggested?.type, "NUMERIC");
    assert.equal(result.suggested?.precision, 20);
    assert.equal(result.suggested?.scale, 6);
    assert.equal(result.unmapped, false);
    assert.equal(result.family, "decimal");
    assert.equal(result.logicalName, "Money");
  });

  it("domain params win over family defaults and mapping params", () => {
    const result = resolveType(attr({ domainId: "Money" }), "postgres", scope);
    assert.equal(result.suggested?.type, "NUMERIC");
    assert.equal(result.suggested?.precision, 12);
    assert.equal(result.suggested?.scale, 4);
  });

  it("family defaultParams win over mapping-carried params", () => {
    // builtin family decimal has defaultParams {precision: 10, scale: 2}
    // while its generic mapping also carries {precision: 10, scale: 2};
    // override the family default at diagram scope to distinguish.
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      diagram: {
        families: { decimal: { defaultParams: { precision: 18, scale: 8 } } },
      },
    };
    const result = resolveType(attr({ family: "decimal" }), "generic", s);
    assert.equal(result.suggested?.type, "DECIMAL");
    assert.equal(result.suggested?.precision, 18);
    assert.equal(result.suggested?.scale, 8);
  });

  it("mapping-carried params apply when nothing above them sets the key", () => {
    // mysql boolean -> TINYINT(1); the family itself declares no params.
    const result = resolveType(attr({ family: "boolean" }), "mysql", scope);
    assert.equal(result.suggested?.type, "TINYINT");
    assert.equal(result.suggested?.length, 1);
  });

  it("merges keys independently across the chain", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: {
        domains: {
          Money: domain({
            name: "Money",
            family: "decimal",
            params: { scale: 4 },
          }),
        },
      },
    };
    // precision from family default (10), scale from domain (4).
    const result = resolveType(attr({ domainId: "Money" }), "postgres", s);
    assert.equal(result.suggested?.precision, 10);
    assert.equal(result.suggested?.scale, 4);
  });
});

describe("resolveType physical shape lookup (spec sections 4.1, 4.3)", () => {
  it("prefers the domain's per-dialect physical spec over the family mapping", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: {
        domains: {
          BigText: domain({
            name: "BigText",
            family: "string",
            physical: { oraclesql: { type: "CLOB" } },
          }),
        },
      },
    };
    const result = resolveType(attr({ domainId: "BigText" }), "oraclesql", s);
    assert.equal(result.suggested?.type, "CLOB");
  });

  it("falls back to the family mapping when the domain lacks the dialect (no error)", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: {
        domains: {
          BigText: domain({
            name: "BigText",
            family: "string",
            physical: { oraclesql: { type: "CLOB" } },
          }),
        },
      },
    };
    const result = resolveType(attr({ domainId: "BigText" }), "mysql", s);
    assert.equal(result.suggested?.type, "VARCHAR");
    assert.equal(result.suggested?.length, 255);
    assert.equal(result.unmapped, false);
  });

  it("falls back to common with unmapped=true when the family lacks the dialect", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: {
        families: {
          geo: { mappings: { postgres: { type: "GEOMETRY" } } },
        },
      },
    };
    const result = resolveType(attr({ family: "geo" }), "sqlite", s);
    assert.equal(result.unmapped, true);
    assert.ok(
      result.diagnostics.some((d) => d.code === "UNRESOLVED_TYPE"),
      "expected an UNRESOLVED_TYPE diagnostic",
    );
  });

  it("reports NAME_CONFLICT-free resolution of a custom family where mapped", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: {
        families: {
          geo: { mappings: { postgres: { type: "GEOMETRY" } } },
        },
      },
    };
    const result = resolveType(attr({ family: "geo" }), "postgres", s);
    assert.equal(result.suggested?.type, "GEOMETRY");
    assert.equal(result.unmapped, false);
  });
});

describe("resolveType three-scope override chain (spec section 5)", () => {
  const appScope: TypeScopeSnapshot = {
    ...emptyTypeScope(),
    application: {
      families: { string: { mappings: { mysql: { type: "VARCHAR", params: { length: 100 } } } } },
    },
  };

  it("workspace overrides application", () => {
    const s: TypeScopeSnapshot = {
      ...appScope,
      workspace: {
        families: { string: { mappings: { mysql: { type: "TEXT" } } } },
      },
    };
    const result = resolveType(attr({ family: "string" }), "mysql", s);
    assert.equal(result.suggested?.type, "TEXT");
  });

  it("diagram overrides workspace and application", () => {
    const s: TypeScopeSnapshot = {
      ...appScope,
      workspace: {
        families: { string: { mappings: { mysql: { type: "TEXT" } } } },
      },
      diagram: {
        families: { string: { mappings: { mysql: { type: "CHAR", params: { length: 10 } } } } },
      },
    };
    const result = resolveType(attr({ family: "string" }), "mysql", s);
    assert.equal(result.suggested?.type, "CHAR");
    assert.equal(result.suggested?.length, 10);
  });

  it("an override for one dialect does not disturb other dialects", () => {
    const result = resolveType(attr({ family: "string" }), "postgres", appScope);
    // builtin mapping for postgres string is VARCHAR(255)
    assert.equal(result.suggested?.type, "VARCHAR");
    assert.equal(result.suggested?.length, 255);
  });

  it("diagram-level domains shadow same-named application domains", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: { domains: { Tag: domain({ name: "Tag", family: "string" }) } },
      diagram: { domains: { Tag: domain({ name: "Tag", family: "uuid" }) } },
    };
    const result = resolveType(attr({ domainId: "Tag" }), "postgres", s);
    assert.equal(result.family, "uuid");
    assert.equal(result.suggested?.type, "UUID");
  });
});

describe("resolveType result shape", () => {
  it("uses the domain name as the logical display name and reports family", () => {
    const s: TypeScopeSnapshot = {
      ...emptyTypeScope(),
      application: { domains: { Code: domain({ name: "Code", family: "string" }) } },
    };
    const result = resolveType(attr({ domainId: "Code" }), "generic", s);
    assert.equal(result.logicalName, "Code");
    assert.equal(result.family, "string");
  });

  it("uses the family id as the logical display name for family references", () => {
    const result = resolveType(attr({ family: "integer" }), "generic", emptyTypeScope());
    assert.equal(result.logicalName, "integer");
    assert.equal(result.family, "integer");
  });

  it("reports unknown family references as unmapped with a diagnostic", () => {
    const result = resolveType(attr({ family: "nope" }), "generic", emptyTypeScope());
    assert.equal(result.unmapped, true);
    assert.ok(result.diagnostics.length > 0);
  });
});
