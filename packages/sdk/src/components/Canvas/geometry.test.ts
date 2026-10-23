import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Table } from "@drawdb/core";
import {
  DEFAULT_TABLE_WIDTH,
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  boundsIntersect,
  cardinalityMarker,
  cardinalitySides,
  fieldAnchor,
  filterVisible,
  relationshipPath,
  snap,
  tableHeight,
  tableWidth,
  visibleWorldBounds,
} from "./geometry.ts";

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: "t1",
    name: "t1",
    x: 100,
    y: 200,
    fields: [
      { id: "f1", name: "id", type: "INTEGER" },
      { id: "f2", name: "name", type: "VARCHAR" },
    ],
    ...overrides,
  };
}

describe("canvas geometry", () => {
  it("falls back to the default table width", () => {
    assert.equal(tableWidth(makeTable()), DEFAULT_TABLE_WIDTH);
    assert.equal(tableWidth(makeTable({ width: 300 })), 300);
  });

  it("computes the table height from its fields", () => {
    assert.equal(tableHeight(makeTable()), TABLE_HEADER_HEIGHT + 2 * TABLE_FIELD_HEIGHT);
    assert.equal(tableHeight(makeTable({ collapsed: true })), TABLE_HEADER_HEIGHT);
  });

  it("anchors a field in the row of the table", () => {
    const table = makeTable();
    const first = fieldAnchor(table, "f1", "right");
    const second = fieldAnchor(table, "f2", "right");

    assert.equal(first.x, table.x + DEFAULT_TABLE_WIDTH);
    assert.equal(first.y, table.y + TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT / 2);
    assert.equal(second.y, first.y + TABLE_FIELD_HEIGHT);
  });

  it("draws a relationship path between two points", () => {
    const path = relationshipPath({ x: 0, y: 0 }, { x: 100, y: 50 });
    assert.ok(path.startsWith("M 0 0"));
    assert.ok(path.includes("100 50"));
  });

  it("maps a cardinality to the two sides of a relationship", () => {
    assert.deepEqual(cardinalitySides("one_to_many"), { start: "one", end: "many" });
    assert.deepEqual(cardinalitySides("many_to_one"), { start: "many", end: "one" });
    assert.deepEqual(cardinalitySides(undefined), { start: "one", end: "one" });
  });

  it("draws a tick for one and a crow's foot for many", () => {
    const one = cardinalityMarker("one", { x: 0, y: 0 }, "right");
    const many = cardinalityMarker("many", { x: 0, y: 0 }, "right");

    assert.equal(one.split("M").length - 1, 2);
    assert.equal(many.split("M").length - 1, 3);
    assert.ok(one.includes("8 6"));
  });

  it("computes the visible part of the world", () => {
    const bounds = visibleWorldBounds(100, 50, 2, 1000, 600);
    assert.equal(bounds.minX, 100);
    assert.equal(bounds.minY, 50);
    assert.equal(bounds.maxX, 600);
    assert.equal(bounds.maxY, 350);
  });

  it("detects overlapping bounds", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    const c = { minX: 20, minY: 20, maxX: 30, maxY: 30 };

    assert.ok(boundsIntersect(a, b));
    assert.ok(!boundsIntersect(a, c));
  });

  it("keeps only the visible elements", () => {
    const items = [
      { id: "in", x: 10 },
      { id: "out", x: 5000 },
    ];
    const world = visibleWorldBounds(0, 0, 1, 1000, 800);

    const visible = filterVisible(
      items,
      (item) => ({
        minX: item.x,
        minY: 0,
        maxX: item.x + 100,
        maxY: 100,
      }),
      world,
    );

    assert.deepEqual(
      visible.map((item) => item.id),
      ["in"],
    );
  });

  it("snaps a coordinate to the grid", () => {
    assert.equal(snap(12, 10), 10);
    assert.equal(snap(16, 10), 20);
    assert.equal(snap(16, 0), 16);
  });
});
