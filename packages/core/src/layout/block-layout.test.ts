import test from "node:test";
import assert from "node:assert/strict";

import type { Field } from "../models/field.ts";
import type { Table } from "../models/table.ts";
import { flowLayout, gridLayout } from "./block-layout.ts";

function field(id: string): Field {
  return { id, name: id, fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" };
}

function table(id: string, fields = 2, width?: number): Table {
  return {
    id,
    name: id,
    x: 1000,
    y: 1000,
    width,
    fields: Array.from({ length: fields }, (_, index) => field(`${id}_${index}`)),
    logical: { id: `logical_${id}`, name: id, attributes: [] },
  } as Table;
}

test("gridLayout: places the tables row by row with the column count it is given", () => {
  const tables = [table("a"), table("b"), table("c"), table("d")];
  const positions = gridLayout(tables, { columns: 2, gap: 40 });

  // Two per row, the row height is the tallest table of the row.
  assert.equal(positions.length, 4);
  assert.equal(positions[0].x, 0);
  assert.equal(positions[1].x, positions[0].x + 220 + 40);
  assert.equal(positions[2].x, 0);
  assert.equal(positions[2].y, 50 + 36 * 2 + 40);
  assert.equal(positions[3].y, positions[2].y);
});

test("gridLayout: a wider table widens its column for the whole grid", () => {
  const tables = [table("a"), table("b", 2, 300), table("c")];
  const positions = gridLayout(tables, { columns: 2, gap: 40 });

  // The second column starts after the first column, which is 220 wide.
  assert.equal(positions[1].x, 220 + 40);
  assert.equal(positions[2].x, 0);
});

test("gridLayout: one table stays at the origin", () => {
  assert.deepEqual(gridLayout([table("only")], {}), [{ x: 0, y: 0 }]);
});

test("gridLayout: no tables is an empty result", () => {
  assert.deepEqual(gridLayout([], {}), []);
});

test("flowLayout: packs left to right and wraps at the width it is given", () => {
  // Three tables of 220 wide with a gap of 40: two fit into 500.
  const tables = [table("a"), table("b"), table("c")];
  const positions = flowLayout(tables, { maxWidth: 500, gap: 40 });

  assert.equal(positions[0].x, 0);
  assert.equal(positions[1].x, 260);
  // The third one wraps to a new row under the tallest table of row one.
  assert.equal(positions[2].x, 0);
  assert.equal(positions[2].y, 50 + 36 * 2 + 40);
});

test("flowLayout: a single table stays at the origin", () => {
  assert.deepEqual(flowLayout([table("only")], {}), [{ x: 0, y: 0 }]);
});