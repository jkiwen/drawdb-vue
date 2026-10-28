import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import { useDiagramStore } from "../stores/diagram.ts";
import { useUIStore } from "../stores/ui.ts";
import { useZoomActions } from "./use-zoom-actions.ts";

/**
 * The zoom group behaviour (design 6.6): fit the diagram, fit the selection
 * and the percent field all land in the ui store the canvas renders from.
 */
function twoTables() {
  const diagram = createEmptyDiagram();
  diagram.tables = [
    createTable({ id: "t_a", name: "a", x: 0, y: 0 }),
    createTable({ id: "t_b", name: "b", x: 600, y: 400 }),
  ];
  return diagram;
}

describe("useZoomActions", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useDiagramStore().setDiagram(twoTables());
  });

  it("fits the whole diagram into the viewport", () => {
    const zoomActions = useZoomActions();
    const ui = useUIStore();
    zoomActions.setViewport({ width: 1000, height: 800 });

    assert.equal(zoomActions.fitToContent(), true);
    // Two 220 wide tables from x 0 to 820, and 50 tall from y 0 to 450:
    // (1000 - 80) / 820 = 1.12 wins over (800 - 80) / 450 = 1.6.
    assert.ok(Math.abs(ui.zoom - 920 / 820) < 1e-9, `zoom was ${ui.zoom}`);
    assert.ok(Number.isFinite(ui.scrollX) && Number.isFinite(ui.scrollY));
  });

  it("fits only the selection", () => {
    const zoomActions = useZoomActions();
    const ui = useUIStore();
    zoomActions.setViewport({ width: 1000, height: 800 });
    ui.selectTable("t_a");

    assert.equal(zoomActions.fitToSelection(), true);
    assert.ok(ui.zoom >= 1, `zoom was ${ui.zoom}`);
  });

  it("refuses to fit when there is nothing to show", () => {
    const zoomActions = useZoomActions();
    const ui = useUIStore();
    zoomActions.setViewport({ width: 1000, height: 800 });
    useDiagramStore().setDiagram(createEmptyDiagram());
    ui.clearSelection();

    assert.equal(zoomActions.fitToContent(), false);
    assert.equal(zoomActions.fitToSelection(), false);
  });

  it("applies the percentage of the field inside the zoom bounds", () => {
    const zoomActions = useZoomActions();
    const ui = useUIStore();

    zoomActions.zoomToPercent(150);
    assert.equal(ui.zoom, 1.5);

    zoomActions.zoomToPercent(10000);
    assert.equal(ui.zoom, 4);

    zoomActions.zoomToPercent(Number.NaN);
    assert.equal(ui.zoom, 4);
  });
});
