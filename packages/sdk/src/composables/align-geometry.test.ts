import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AlignBox } from "./align-geometry.ts";
import { alignBoxes, distributeBoxes } from "./align-geometry.ts";

/**
 * The geometry of the toolbar alignment group (design 6.5). The boxes are
 * plain numbers, so the expectations read as coordinates.
 */
const boxes: AlignBox[] = [
  { id: "a", x: 0, y: 0, width: 100, height: 50 },
  { id: "b", x: 200, y: 100, width: 100, height: 50 },
  { id: "c", x: 400, y: 300, width: 100, height: 50 },
];

const xOf = (result: { id: string; x: number }[], id: string) =>
  result.find((box) => box.id === id)!.x;
const yOf = (result: { id: string; y: number }[], id: string) =>
  result.find((box) => box.id === id)!.y;

describe("alignBoxes", () => {
  it("aligns the left edges to the left-most box", () => {
    const result = alignBoxes(boxes, "left");
    assert.deepEqual(result.map((box) => box.x), [0, 0, 0]);
    assert.deepEqual(result.map((box) => box.y), [0, 100, 300]);
  });

  it("aligns the right edges to the right-most box", () => {
    const result = alignBoxes(boxes, "right");
    assert.deepEqual(result.map((box) => box.x), [400, 400, 400]);
  });

  it("aligns the top and the bottom edges", () => {
    assert.deepEqual(alignBoxes(boxes, "top").map((box) => box.y), [0, 0, 0]);
    assert.deepEqual(alignBoxes(boxes, "bottom").map((box) => box.y), [300, 300, 300]);
  });

  it("centres on the horizontal and the vertical middle", () => {
    // The box spans x 0..500 and y 0..350.
    const horizontal = alignBoxes(boxes, "center-h");
    assert.deepEqual(horizontal.map((box) => box.x), [200, 200, 200]);

    const vertical = alignBoxes(boxes, "center-v");
    assert.deepEqual(vertical.map((box) => box.y), [150, 150, 150]);
  });

  it("keeps a single box where it is", () => {
    const single = [boxes[0]!];
    assert.deepEqual(alignBoxes(single, "left"), [{ id: "a", x: 0, y: 0 }]);
  });
});

describe("distributeBoxes", () => {
  it("makes the horizontal gaps equal and keeps the ends", () => {
    const result = distributeBoxes(boxes, "horizontal");
    // The span is 0..500, 300 of it is tables, so each gap is 100.
    assert.equal(xOf(result, "a"), 0);
    assert.equal(xOf(result, "b"), 200);
    assert.equal(xOf(result, "c"), 400);
  });

  it("makes the vertical gaps equal even when the input is unsorted", () => {
    const shuffled = [boxes[2]!, boxes[0]!, boxes[1]!];
    const result = distributeBoxes(shuffled, "vertical");
    // The span is 0..350, 150 of it is tables, so each gap is 100.
    assert.deepEqual(result.map((box) => box.y), [300, 0, 150]);
  });

  it("keeps two boxes where they are", () => {
    const pair = [boxes[0]!, boxes[1]!];
    assert.deepEqual(distributeBoxes(pair, "horizontal"), [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 100 },
    ]);
  });

  it("does not change the other axis", () => {
    assert.equal(yOf(distributeBoxes(boxes, "horizontal"), "b"), 100);
    assert.equal(xOf(distributeBoxes(boxes, "vertical"), "b"), 200);
  });
});
