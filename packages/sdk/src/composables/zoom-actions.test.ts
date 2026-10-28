import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Table } from "@drawdb/core";
import {
  contentBounds,
  fitScroll,
  fitZoom,
  type ViewportSize,
} from "./zoom-actions.ts";

/**
 * The geometry behind "fit the diagram into the canvas" and "zoom to the
 * selection" (design 6.6). Pure functions, so the numbers are the test.
 *
 * A table without `width` is 220 wide, and its height is the 50 of the
 * header plus 36 per field — the same numbers the card layout uses.
 */
const table = (
  id: string,
  x: number,
  y: number,
  fields = 0,
): Table => ({ id, name: id, x, y, width: 200, fields: Array.from({ length: fields }, () => ({})) }) as unknown as Table;

// 200 wide, 86 tall starting at y 100; 200 wide, 122 tall starting at y 300.
const tables = [table("a", 100, 100, 1), table("b", 400, 300, 2)];

const viewport: ViewportSize = { width: 1000, height: 800 };

describe("contentBounds", () => {
  it("wraps every table in one box", () => {
    assert.deepEqual(contentBounds(tables), {
      x: 100,
      y: 100,
      width: 500,
      height: 322,
    });
  });

  it("has no box without tables", () => {
    assert.equal(contentBounds([]), null);
  });
});

describe("fitZoom", () => {
  it("scales the content so it fits with the padding", () => {
    // (1000 - 80) / 500 = 1.84, (800 - 80) / 322 = 2.24: the width wins.
    const zoom = fitZoom(contentBounds(tables)!, viewport);
    assert.ok(Math.abs(zoom - 1.84) < 1e-9, `zoom was ${zoom}`);
  });

  it("stays inside the zoom bounds and ignores an empty viewport", () => {
    const huge = { x: 0, y: 0, width: 40000, height: 40000 };
    assert.equal(fitZoom(huge, viewport, { padding: 40 }), 0.1);
    assert.equal(fitZoom(contentBounds(tables)!, { width: 0, height: 0 }), 1);
  });
});

describe("fitScroll", () => {
  it("centres the content inside the canvas", () => {
    const bounds = contentBounds(tables)!;
    // At zoom 2 the box is 1000x644: exactly as wide as the canvas, 156
    // shorter, so only the vertical scroll moves.
    assert.deepEqual(fitScroll(bounds, viewport, 2), {
      scrollX: bounds.x,
      scrollY: bounds.y - (viewport.height - bounds.height * 2) / (2 * 2),
    });
  });
});
