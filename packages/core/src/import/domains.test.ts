import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { domainConflicts, mergeDiagramDomains } from "./domains.ts";
import type { LogicalDomain } from "../models/domain.ts";

function domain(overrides: Partial<LogicalDomain> & { name: string }): LogicalDomain {
  return { id: `domain_${overrides.name}`, family: "string", ...overrides };
}

describe("domainConflicts (ruling: a conflict has no priority rule)", () => {
  it("names the family, the parameters and each dialect that disagrees", () => {
    const mine = domain({
      name: "_ID",
      family: "string",
      params: { length: 32 },
      physical: { mysql: { type: "CHAR", params: { length: 32 } } },
    });
    const theirs = domain({
      name: "_ID",
      id: "incoming",
      family: "integer",
      params: { length: 64 },
      physical: { mysql: { type: "VARCHAR", params: { length: 64 } } },
    });
    assert.deepEqual(
      domainConflicts(mine, theirs).map((entry) => `${entry.kind}:${entry.database ?? ""}`),
      ["family:", "params:", "physical:mysql"],
    );
  });

  it("says nothing about a dialect only the import describes", () => {
    const mine = domain({ name: "_ID", physical: { mysql: { type: "CHAR" } } });
    const theirs = domain({ name: "_ID", id: "incoming", physical: { postgres: { type: "TEXT" } } });
    assert.deepEqual(domainConflicts(mine, theirs), []);
  });

  it("says nothing when the two sides agree", () => {
    const mine = domain({ name: "_ID", params: { length: 20 }, physical: { mysql: { type: "CHAR" } } });
    const theirs = domain({ name: "_ID", id: "incoming", params: { length: 20 }, physical: { mysql: { type: "CHAR" } } });
    assert.deepEqual(domainConflicts(mine, theirs), []);
  });
});

describe("mergeDiagramDomains (ruling: the user rules on every conflict)", () => {
  it("keeps the domains of the diagram and appends the ones it does not have", () => {
    const result = mergeDiagramDomains([domain({ name: "_ID" })], [domain({ name: "_Code", id: "domain_code" })]);
    assert.deepEqual(
      result.domains.map((item) => item.name),
      ["_ID", "_Code"],
    );
    assert.equal(result.idMap.get("domain_code"), "domain_code");
    assert.deepEqual(result.notes, []);
    assert.deepEqual(result.undecided, []);
  });

  it("adds the dialects only the import describes without asking", () => {
    const mine = domain({ name: "_ID", physical: { mysql: { type: "CHAR", params: { length: 32 } } } });
    const theirs = domain({ name: "_ID", id: "incoming", physical: { postgres: { type: "TEXT" } } });
    const result = mergeDiagramDomains([mine], [theirs]);
    assert.deepEqual(result.domains[0]!.physical, {
      mysql: { type: "CHAR", params: { length: 32 } },
      postgres: { type: "TEXT" },
    });
    assert.deepEqual(result.notes, [{ name: "_ID", added: ["postgres"] }]);
    assert.equal(result.idMap.get("incoming"), "domain__ID");
    assert.deepEqual(result.undecided, []);
  });

  it("holds the family conflict open until the user picks a side", () => {
    const mine = domain({ name: "INT-4", family: "integer", params: { length: 4 } });
    const theirs = domain({ name: "INT-4", id: "incoming", family: "string" });
    const open = mergeDiagramDomains([mine], [theirs]);
    assert.equal(open.domains[0]!.family, "integer");
    assert.deepEqual(open.undecided.map((entry) => entry.kind), ["family"]);

    const ruled = mergeDiagramDomains([mine], [theirs], [{ name: "INT-4", kind: "family", side: "theirs" }]);
    assert.equal(ruled.domains[0]!.family, "string");
    assert.deepEqual(ruled.undecided, []);
  });

  it("keeps the diagram's side when the user picks mine", () => {
    const mine = domain({ name: "_Name", params: { length: 20 } });
    const theirs = domain({ name: "_Name", id: "incoming", params: { length: 50 } });
    const result = mergeDiagramDomains([mine], [theirs], [{ name: "_Name", kind: "params", side: "mine" }]);
    assert.deepEqual(result.domains[0]!.params, { length: 20 });
    assert.deepEqual(result.undecided, []);
  });

  it("takes the parameters of the import only when the diagram states none", () => {
    const mine = domain({ name: "_Name" });
    const theirs = domain({ name: "_Name", id: "incoming", params: { length: 20 } });
    const result = mergeDiagramDomains([mine], [theirs]);
    assert.deepEqual(result.domains[0]!.params, { length: 20 });
    assert.deepEqual(result.notes, []);
    assert.deepEqual(result.undecided, []);
  });

  it("names the dialect the two sides describe differently and waits for it", () => {
    const mine = domain({ name: "_ID", physical: { mysql: { type: "CHAR", params: { length: 32 } } } });
    const theirs = domain({ name: "_ID", id: "incoming", physical: { mysql: { type: "VARCHAR", params: { length: 64 } } } });
    const open = mergeDiagramDomains([mine], [theirs]);
    assert.deepEqual(open.undecided, [
      {
        name: "_ID",
        kind: "physical",
        database: "mysql",
        mine: { type: "CHAR", params: { length: 32 } },
        theirs: { type: "VARCHAR", params: { length: 64 } },
      },
    ]);

    const ruled = mergeDiagramDomains([mine], [theirs], [
      { name: "_ID", kind: "physical", database: "mysql", side: "theirs" },
    ]);
    assert.deepEqual(ruled.domains[0]!.physical, { mysql: { type: "VARCHAR", params: { length: 64 } } });
    assert.deepEqual(ruled.undecided, []);
  });

  it("leaves the conflicts the user has not ruled on open", () => {
    const mine = domain({ name: "_ID", family: "string", params: { length: 32 } });
    const theirs = domain({ name: "_ID", id: "incoming", family: "integer", params: { length: 64 } });
    const result = mergeDiagramDomains([mine], [theirs], [{ name: "_ID", kind: "family", side: "theirs" }]);
    assert.equal(result.domains[0]!.family, "integer");
    assert.deepEqual(result.undecided.map((entry) => entry.kind), ["params"]);
  });

  it("merges three sides of the same name into one domain", () => {
    const result = mergeDiagramDomains(
      [domain({ name: "_ID" })],
      [domain({ name: "_ID", id: "second" }), domain({ name: "_ID", id: "third" })],
    );
    assert.equal(result.domains.length, 1);
    assert.equal(result.idMap.get("second"), "domain__ID");
    assert.equal(result.idMap.get("third"), "domain__ID");
  });

  it("does nothing when the import brings no domains", () => {
    const mine = [domain({ name: "_ID" })];
    const result = mergeDiagramDomains(mine, []);
    assert.deepEqual(result.domains, mine);
    assert.equal(result.idMap.size, 0);
  });
});
