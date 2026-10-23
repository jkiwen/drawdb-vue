import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { MAX_ZOOM, MIN_ZOOM, useViewport } from "./use-viewport.ts";

describe("useViewport", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("clamps the zoom to the allowed range", () => {
    const { zoom, setZoom } = useViewport();

    setZoom(10);
    assert.equal(zoom.value, MAX_ZOOM);

    setZoom(0.01);
    assert.equal(zoom.value, MIN_ZOOM);
  });

  it("zooms in and out in fixed steps", () => {
    const { zoom, zoomIn, zoomOut } = useViewport();

    zoomIn();
    assert.ok(zoom.value > 1);

    zoomOut();
    assert.equal(zoom.value, 1);
  });

  it("resets the viewport", () => {
    const { zoom, scrollX, scrollY, setZoom, pan, resetView } = useViewport();

    setZoom(2);
    pan(120, 40);
    assert.equal(scrollX.value, 120);
    assert.equal(scrollY.value, 40);

    resetView();
    assert.equal(zoom.value, 1);
    assert.equal(scrollX.value, 0);
    assert.equal(scrollY.value, 0);
  });

  it("converts screen coordinates into canvas coordinates", () => {
    const { setZoom, pan, toCanvasPoint } = useViewport();

    setZoom(2);
    pan(50, 20);

    const point = toCanvasPoint(120, 80, { left: 20, top: 10 });
    // screen = (canvas - scroll) * zoom  =>  canvas = screen / zoom + scroll
    assert.equal(point.x, 100 / 2 + 50);
    assert.equal(point.y, 70 / 2 + 20);
  });

  it("converts canvas coordinates into screen coordinates", () => {
    const { setZoom, pan, toScreenPoint } = useViewport();

    setZoom(2);
    pan(50, 20);

    const point = toScreenPoint(100, 60);
    assert.equal(point.x, (100 - 50) * 2);
    assert.equal(point.y, (60 - 20) * 2);
  });

  it("round-trips a point through both conversions", () => {
    const { setZoom, pan, toCanvasPoint, toScreenPoint } = useViewport();

    setZoom(1.5);
    pan(-30, 15);

    const canvas = toCanvasPoint(200, 150, { left: 0, top: 0 });
    const screen = toScreenPoint(canvas.x, canvas.y);
    assert.ok(Math.abs(screen.x - 200) < 1e-9);
    assert.ok(Math.abs(screen.y - 150) < 1e-9);
  });
});
