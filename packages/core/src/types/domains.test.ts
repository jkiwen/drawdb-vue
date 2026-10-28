import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LogicalDomain } from "../models/domain.ts";
import {
  emptyTypeScope,
  registerDomain,
  resolveType,
} from "./resolve.ts";

describe("logical domains (Q13: parentId kept, no inheritance)", () => {
  it("keeps parentId as data but never follows the parent chain when resolving", () => {
    // Parent maps oracle to CLOB; the child declares no physical override.
    // If inheritance were implemented the child would resolve to CLOB;
    // per Q13 it must fall back to its own family mapping instead.
    let scope = emptyTypeScope();
    const parent = registerDomain(scope, "application", {
      id: "BaseText",
      name: "BaseText",
      family: "text",
      physical: { oraclesql: { type: "CLOB" } },
    });
    assert.ok(parent.ok);
    scope = parent.scope;
    const child = registerDomain(scope, "application", {
      id: "NoteText",
      name: "NoteText",
      family: "string",
      parentId: "BaseText",
    });
    assert.ok(child.ok);
    scope = child.scope;

    const stored = scope.application.domains?.NoteText;
    assert.equal(stored?.parentId, "BaseText");

    const result = resolveType(
      { id: "a1", name: "note", logicalType: { domainId: "NoteText" } },
      "oraclesql",
      scope,
    );
    // Own family (string) oracle mapping is NVARCHAR2(255), not the parent's CLOB.
    assert.equal(result.suggested?.type, "NVARCHAR2");
    assert.equal(result.suggested?.length, 255);
  });

  it("domains carry their physical spec per dialect (spec section 3.3)", () => {
    const domain: LogicalDomain = {
      id: "Money",
      name: "Money",
      family: "decimal",
      physical: { oraclesql: { type: "NUMBER", params: { precision: 19, scale: 4 } } },
    };
    const reg = registerDomain(emptyTypeScope(), "application", domain);
    assert.ok(reg.ok);
    const result = resolveType(
      { id: "a1", name: "amount", logicalType: { domainId: "Money" } },
      "oraclesql",
      reg.scope,
    );
    assert.equal(result.suggested?.type, "NUMBER");
    assert.equal(result.suggested?.precision, 19);
    assert.equal(result.suggested?.scale, 4);
  });
});
