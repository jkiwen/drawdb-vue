import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { iconOf } from "./outline-icons.ts";
import type { OutlineNode } from "./outline-nodes.ts";

/**
 * The glyph of a row (review of 2026-10-29, item 3): every kind of element
 * gets its own shape, and the keys are told apart by the group they belong
 * to. The mapping is pure, so the test reads it without a DOM.
 */
function node(overrides: Partial<OutlineNode>): OutlineNode {
  return {
    id: "x",
    kind: "table",
    label: "x",
    matched: false,
    children: [],
    ...overrides,
  };
}

describe("iconOf", () => {
  it("gives every kind of element its own glyph", () => {
    assert.equal(iconOf(node({ kind: "table" })), "table");
    assert.equal(iconOf(node({ kind: "field" })), "field");
    assert.equal(iconOf(node({ kind: "relationship" })), "relationship");
    assert.equal(iconOf(node({ kind: "area" })), "area");
    assert.equal(iconOf(node({ kind: "area-table" })), "area");
    assert.equal(iconOf(node({ kind: "note" })), "note");
    assert.equal(iconOf(node({ kind: "view" })), "view");
    assert.equal(iconOf(node({ kind: "enum" })), "enum");
    assert.equal(iconOf(node({ kind: "type" })), "type");
  });

  it("names the group a row belongs to", () => {
    for (const key of ["fields", "primary", "unique", "foreign", "indexes"] as const) {
      assert.equal(iconOf(node({ kind: "group", group: key })), key);
    }
  });

  it("tells the keys apart by the kind inside their id", () => {
    assert.equal(
      iconOf(node({ kind: "constraint", id: "constraint:t1:primary" })),
      "primary",
    );
    assert.equal(
      iconOf(node({ kind: "constraint", id: "constraint:t1:unique:uk1" })),
      "unique",
    );
    assert.equal(
      iconOf(node({ kind: "constraint", id: "constraint:t1:foreign:r1" })),
      "foreign",
    );
    assert.equal(
      iconOf(node({ kind: "constraint", id: "constraint:t1:index:i1" })),
      "indexes",
    );
    assert.equal(iconOf(node({ kind: "constraint", id: "constraint:t1:other" })), "key");
  });
});
