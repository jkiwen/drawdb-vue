import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  cascadeShift,
  centreOfViewport,
  placeAt,
  NEW_TABLE_SIZE,
  CASCADE_STEP,
  type PlacementViewport,
} from "./placement.ts";

const viewport: PlacementViewport = { width: 800, height: 600 };
const scroll = { scrollX: 0, scrollY: 0 };

describe("centreOfViewport", () => {
  it("is the middle of the screen in the coordinates of the diagram", () => {
    assert.deepEqual(
      centreOfViewport({ ...scroll, zoom: 1, viewport }),
      { x: 400, y: 300 },
    );
  });

  it("divides the screen by the zoom before adding the scroll", () => {
    assert.deepEqual(
      centreOfViewport({ scrollX: 100, scrollY: 50, zoom: 2, viewport }),
      { x: 100 + 200, y: 50 + 150 },
    );
  });

  it("falls back to a fixed point while the canvas has no size yet", () => {
    assert.deepEqual(
      centreOfViewport({
        ...scroll,
        zoom: 1,
        viewport: { width: 0, height: 0 },
        fallback: { x: 100, y: 100 },
      }),
      { x: 100, y: 100 },
    );
  });

  it("ignores a zoom of zero instead of dividing by it", () => {
    assert.deepEqual(
      centreOfViewport({ ...scroll, zoom: 0, viewport }),
      { x: 400, y: 300 },
    );
  });
});

describe("placeAt", () => {
  it("puts the centre of the element on the point", () => {
    assert.deepEqual(placeAt({ x: 400, y: 300 }, { width: 220, height: 50 }), {
      x: 290,
      y: 275,
    });
  });

  it("moves the element by the shift, so two of them do not stack", () => {
    assert.deepEqual(
      placeAt({ x: 400, y: 300 }, NEW_TABLE_SIZE, 2 * CASCADE_STEP),
      { x: 400 - 110 + 2 * CASCADE_STEP, y: 300 - 25 + 2 * CASCADE_STEP },
    );
  });
});

describe("cascadeShift", () => {
  it("counts the elements that are already there", () => {
    assert.equal(cascadeShift(0), 0);
    assert.equal(cascadeShift(1), CASCADE_STEP);
    assert.equal(cascadeShift(4), 4 * CASCADE_STEP);
    assert.equal(cascadeShift(5), 5 * CASCADE_STEP);
  });
});
