import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeDiagramDomains } from "./domains.ts";
import type { LogicalDomain } from "../models/domain.ts";

function domain(overrides: Partial<LogicalDomain> & { name: string }): LogicalDomain {
  return { id: `domain_${overrides.name}`, family: "string", ...overrides };
}

describe("mergeDiagramDomains (ruling: a shared name is merged inside the domain)", () => {
  it("keeps the domains of the diagram and appends the ones it does not have", () => {
    const result = mergeDiagramDomains([domain({ name: "_ID" })], [domain({ name: "_Code", id: "domain_code" })]);
    assert.deepEqual(
      result.domains.map((item) => item.name),
      ["_ID", "_Code"],
    );
    assert.equal(result.idMap.get("domain_code"), "domain_code");
    assert.deepEqual(result.notes, []);
  });

  it("unites the physical mappings of a shared name, the diagram's own winning", () => {
    const mine = domain({ name: "_ID", physical: { mysql: { type: "CHAR", params: { length: 32 } } } });
    const theirs = domain({
      name: "_ID",
      id: "incoming",
      physical: {
        mysql: { type: "VARCHAR", params: { length: 64 } },
        postgres: { type: "TEXT" },
      },
    });
    const result = mergeDiagramDomains([mine], [theirs]);
    const merged = result.domains[0]!;
    assert.deepEqual(merged.physical, {
      mysql: { type: "CHAR", params: { length: 32 } },
      postgres: { type: "TEXT" },
    });
    assert.deepEqual(result.notes, [{ name: "_ID", replaced: ["mysql"], added: ["postgres"], familyKept: false, paramsKept: false }]);
    assert.equal(result.idMap.get("incoming"), "domain__ID");
    assert.equal(result.domains.length, 1);
  });

  it("keeps the family the diagram already uses when the two disagree", () => {
    const mine = domain({ name: "INT-4", family: "integer", params: { length: 4 } });
    const theirs = domain({ name: "INT-4", id: "incoming", family: "string" });
    const result = mergeDiagramDomains([mine], [theirs]);
    assert.equal(result.domains[0]!.family, "integer");
    assert.deepEqual(result.domains[0]!.params, { length: 4 });
    assert.equal(result.notes.length, 1);
    assert.equal(result.notes[0]!.familyKept, true);
    assert.equal(result.notes[0]!.paramsKept, false);
  });

  it("takes the parameters of the import only when the diagram states none", () => {
    const mine = domain({ name: "_Name" });
    const theirs = domain({ name: "_Name", id: "incoming", params: { length: 20 } });
    const result = mergeDiagramDomains([mine], [theirs]);
    assert.deepEqual(result.domains[0]!.params, { length: 20 });
    assert.deepEqual(result.notes, []);
  });

  it("names the two sides when their parameters disagree", () => {
    const mine = domain({ name: "_Name", params: { length: 20 } });
    const theirs = domain({ name: "_Name", id: "incoming", params: { length: 50 } });
    const result = mergeDiagramDomains([mine], [theirs]);
    assert.deepEqual(result.domains[0]!.params, { length: 20 });
    assert.equal(result.notes[0]!.paramsKept, true);
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
