import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useDrag } from "./use-drag.ts";

describe("useDrag", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts out idle", () => {
    const { dragState, endDrag } = useDrag();

    assert.equal(dragState.active, false);
    assert.equal(endDrag(), null);
  });

  it("tracks the movement of a drag", () => {
    const { dragState, beginDrag, updateDrag } = useDrag();

    beginDrag({ x: 10, y: 20 }, ["t1", "t2"]);
    assert.equal(dragState.active, true);
    assert.deepEqual(dragState.ids, ["t1", "t2"]);

    updateDrag({ x: 30, y: 50 });
    assert.deepEqual(dragState.delta, { x: 20, y: 30 });
  });

  it("returns the moved ids when the drag ends", () => {
    const { dragState, beginDrag, updateDrag, endDrag } = useDrag();

    beginDrag({ x: 0, y: 0 }, ["t1"]);
    updateDrag({ x: 5, y: 7 });

    const result = endDrag();
    assert.deepEqual(result, { ids: ["t1"], delta: { x: 5, y: 7 } });
    assert.equal(dragState.active, false);
  });

  it("discards a cancelled drag", () => {
    const { dragState, beginDrag, updateDrag, cancelDrag, endDrag } = useDrag();

    beginDrag({ x: 0, y: 0 }, ["t1"]);
    updateDrag({ x: 5, y: 5 });
    cancelDrag();

    assert.equal(dragState.active, false);
    assert.equal(endDrag(), null);
  });

  it("snaps the origin to the grid", () => {
    const { dragState, beginDrag } = useDrag();

    beginDrag({ x: 13, y: 27 }, ["t1"], { snapToGrid: true, gridSize: 10 });
    assert.deepEqual(dragState.origin, { x: 10, y: 30 });
  });

  it("keeps the origin untouched when the grid is disabled", () => {
    const { dragState, beginDrag } = useDrag();

    beginDrag({ x: 13, y: 27 }, ["t1"], { snapToGrid: false, gridSize: 10 });
    assert.deepEqual(dragState.origin, { x: 13, y: 27 });
  });
});
