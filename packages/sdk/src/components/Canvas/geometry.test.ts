import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Area, Relationship, Table } from "@drawdb/core";
import {
  COLLAPSED_AREA_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  boundsIntersect,
  cardinalityMarker,
  cardinalitySides,
  collapsedAreaAnchor,
  fieldAnchor,
  filterVisible,
  nearestEdgeSide,
  relationshipAnchors,
  relationshipPath,
  snap,
  tableEdgeAnchor,
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
    logical: { id: "l_t1", name: "t1", attributes: [] },
    fields: [
      { id: "f1", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
      { id: "f2", name: "name", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
    ],
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: "r1",
    name: "r1",
    startTableId: "t1",
    endTableId: "t2",
    startFieldId: "f1",
    endFieldId: "f1",
    cardinality: "one_to_many",
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

  it("picks the edge of a box nearest to a point", () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    assert.equal(nearestEdgeSide(bounds, { x: 200, y: 50 }), "right");
    assert.equal(nearestEdgeSide(bounds, { x: -50, y: 10 }), "left");
    assert.equal(nearestEdgeSide(bounds, { x: 50, y: 200 }), "bottom");
    assert.equal(nearestEdgeSide(bounds, { x: 50, y: -80 }), "top");
  });

  it("anchors a field on the edge of the table nearest the other end", () => {
    const table = makeTable();
    const bottom = tableEdgeAnchor(table, "f1", { x: 210, y: 900 });
    assert.equal(bottom.side, "bottom");
    assert.equal(bottom.y, 200 + TABLE_HEADER_HEIGHT + 2 * TABLE_FIELD_HEIGHT);
    assert.equal(bottom.x, 210);

    const right = tableEdgeAnchor(table, "f2", { x: 900, y: 250 });
    assert.equal(right.side, "right");
    assert.equal(right.x, table.x + DEFAULT_TABLE_WIDTH);
    assert.equal(
      right.y,
      table.y + TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT * 1.5,
    );
  });

  it("anchors a relationship between tables side by side on the left and right edges", () => {
    const left = makeTable({ id: "l", x: 100, y: 200 });
    const right = makeTable({ id: "r", x: 600, y: 200 });
    const { start, end } = relationshipAnchors(makeRelationship(), left, right);

    assert.equal(start.side, "right");
    assert.equal(start.x, 100 + DEFAULT_TABLE_WIDTH);
    assert.equal(end.side, "left");
    assert.equal(end.x, 600);
  });

  it("anchors a relationship between stacked tables on the bottom and top edges", () => {
    const top = makeTable({ id: "t", x: 100, y: 100 });
    const bottom = makeTable({ id: "b", x: 100, y: 400 });
    const { start, end } = relationshipAnchors(makeRelationship(), top, bottom);

    assert.equal(start.side, "bottom");
    assert.equal(start.y, 100 + TABLE_HEADER_HEIGHT + 2 * TABLE_FIELD_HEIGHT);
    assert.equal(start.x, 210);
    assert.equal(end.side, "top");
    assert.equal(end.y, 400);
    assert.equal(end.x, 210);
  });

  it("anchors a collapsed area on the edge of its title bar", () => {
    const area: Area = { id: "a", name: "a", x: 40, y: 60, width: 400, height: 300 };

    const right = collapsedAreaAnchor(area, { x: 810, y: 163 });
    assert.equal(right.side, "right");
    assert.equal(right.x, 440);
    // The anchor is clamped to the title bar, not to the point it faces.
    assert.equal(right.y, 60 + COLLAPSED_AREA_HEIGHT);

    const below = collapsedAreaAnchor(area, { x: 240, y: 500 });
    assert.equal(below.side, "bottom");
    assert.equal(below.x, 240);
    assert.equal(below.y, 60 + COLLAPSED_AREA_HEIGHT);
  });

  it("bends the path out of the side the anchor sits on", () => {
    const path = relationshipPath(
      { x: 210, y: 222 },
      { x: 210, y: 400 },
      { startSide: "bottom", endSide: "top" },
    );
    // The control points leave the anchors straight down and straight up.
    assert.ok(path.includes("C 210 311, 210 311, 210 400"));
  });

  it("keeps the bezier of a relationship path free of obstacles", () => {
    const path = relationshipPath(
      { x: 300, y: 188 },
      { x: 700, y: 188 },
      { startSide: "right", endSide: "left", obstacles: [] },
    );
    assert.ok(!path.includes("L"));
  });

  it("routes the path around an obstacle that stands in the way", () => {
    const path = relationshipPath(
      { x: 300, y: 188 },
      { x: 700, y: 188 },
      {
        startSide: "right",
        endSide: "left",
        obstacles: [{ minX: 460, minY: 130, maxX: 680, maxY: 216 }],
      },
    );
    assert.ok(path.includes("L"), "the detour is a polyline");
    // The corridor runs below the obstacle, with a margin of 16.
    assert.ok(path.includes("232"));
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
