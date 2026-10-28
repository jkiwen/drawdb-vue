import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { nextTick } from "vue";
import type { Area, Table } from "@drawdb/core";
import { useDiagramStore, type DiagramStore } from "../../stores/diagram.ts";
import Canvas from "./Canvas.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * A relationship between a table inside an area and a table outside of it.
 *
 * The line crosses the border of the area, whether the area is expanded or
 * collapsed. When the area is collapsed the hidden end of the relationship
 * anchors on the title bar of the area.
 */

const AREA: Area = {
  id: "area-1",
  name: "area 1",
  x: 40,
  y: 60,
  width: 400,
  height: 300,
};

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

function mountCanvas(pinia: Pinia) {
  return mount(Canvas, {
    props: { width: 1200, height: 800 },
    global: { plugins: [pinia, naive] },
  });
}

function seedTable(diagram: DiagramStore, table: Pick<Table, "id" | "x" | "y">): void {
  const fieldId = `${table.id}_id`;
  diagram.addTable({
    name: String(table.id),
    logical: {
      id: `l_${table.id}`,
      name: String(table.id),
      attributes: [
        { id: `a_${fieldId}`, name: "id", logicalType: { family: "integer" }, fieldId },
      ],
    },
    fields: [
      { id: fieldId, name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
    ],
    ...table,
  });
}

/** A relationship between two seeded tables: `${from}_id` → `${to}_id`. */
function seedRelationship(diagram: DiagramStore, from: string, to: string, id = "rel-1"): void {
  diagram.addRelationship({
    id,
    name: `${from}_${to}`,
    startTableId: from,
    endTableId: to,
    startFieldId: `${from}_id`,
    endFieldId: `${to}_id`,
    cardinality: "many_to_one",
  });
}

/** Dispatches a pointer event, the way a browser does. */
function fire(element: Element, type: string): void {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  element.dispatchEvent(event);
}

describe("a relationship that crosses the border of an area", () => {
  it("draws the relationship between a table in an area and a table outside", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    // Inside the area (x 40..440, y 60..360).
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    // Outside of the area, to the right.
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);

    const relationship = wrapper.find('[data-testid="relationship-rel-1"]');
    assert.equal(relationship.exists(), true, "the relationship must be drawn");
    const path = relationship.find("path.ddb-canvas-relationship__line");
    assert.equal(path.exists(), true, "the relationship must have a line");
    assert.ok(path.attributes("d"), "the line must have a path");
  });

  it("keeps drawing the relationship when the area folds, anchored on its title bar", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);
    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    const relationship = wrapper.find('[data-testid="relationship-rel-1"]');
    assert.equal(
      relationship.exists(),
      true,
      "the relationship must stay drawn when the area folds",
    );
    const markers = relationship.findAll(".ddb-canvas-relationship__cardinality");
    assert.equal(markers.length, 2);
    // The visible end stays on the field row of its table.
    assert.equal(markers[0].attributes("transform"), "translate(700 188)");
    // The end that folds with the area anchors on its title bar (x 40..440, y 60..88).
    assert.equal(markers[1].attributes("transform"), "translate(440 88)");
  });

  it("draws the relationship between the title bars of two collapsed areas", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    diagram.addArea({ id: "area-2", name: "area 2", x: 600, y: 60, width: 400, height: 300 });
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);
    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    fire(wrapper.find('[data-testid="area-toggle-area-2"]').element, "click");
    await nextTick();

    const relationship = wrapper.find('[data-testid="relationship-rel-1"]');
    assert.equal(
      relationship.exists(),
      true,
      "the relationship between two collapsed areas must stay drawn",
    );
    const markers = relationship.findAll(".ddb-canvas-relationship__cardinality");
    assert.equal(markers.length, 2);
    // The end in area 2 anchors on the left edge of its title bar.
    assert.equal(markers[0].attributes("transform"), "translate(600 88)");
    // The end in area 1 anchors on the right edge of its title bar.
    assert.equal(markers[1].attributes("transform"), "translate(440 88)");
  });

  it("still hides the relationship whose both ends fold with the same area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 100, y: 240 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);
    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="relationship-rel-1"]').exists(), false);
  });

  it("keeps the relationship between two tables outside of a collapsed area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    seedTable(diagram, { id: "comments", x: 700, y: 400 });
    seedRelationship(diagram, "posts", "users", "rel-1");
    seedRelationship(diagram, "posts", "comments", "rel-2");

    const wrapper = mountCanvas(pinia);
    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="relationship-rel-2"]').exists(), true);
  });

  it("keeps the relationship between two tables inside an expanded area", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    diagram.addArea(AREA);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 100, y: 240 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="relationship-rel-1"]').exists(), true);
  });
});

describe("the anchor of a relationship", () => {
  it("sits on the top and bottom edges of stacked tables", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedTable(diagram, { id: "users", x: 100, y: 100 });
    seedTable(diagram, { id: "posts", x: 100, y: 400 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);

    const relationship = wrapper.find('[data-testid="relationship-rel-1"]');
    const markers = relationship.findAll(".ddb-canvas-relationship__cardinality");
    assert.equal(markers.length, 2);
    // Posts stands below users: the line leaves its top edge...
    assert.equal(markers[0].attributes("transform"), "translate(210 400)");
    // ...and arrives at the bottom edge of users (100 + header 50 + field 36).
    assert.equal(markers[1].attributes("transform"), "translate(210 186)");
  });
});

describe("the path of a relationship", () => {
  it("routes around a table that stands in the way", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    // The blocker (x 460..680, y 130..216) covers the straight line at y 188.
    seedTable(diagram, { id: "blocker", x: 460, y: 130 });
    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);

    const path = wrapper
      .find('[data-testid="relationship-rel-1"]')
      .find("path.ddb-canvas-relationship__line")
      .attributes("d");
    assert.ok(path?.includes("L"), `expected a detour polyline, got: ${path}`);
    assert.ok(path?.includes("232"), `expected the corridor below the blocker, got: ${path}`);
  });

  it("routes around an unrelated area that stands in the way", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedTable(diagram, { id: "users", x: 80, y: 120 });
    seedTable(diagram, { id: "posts", x: 700, y: 120 });
    // The area holds neither table, but the straight line crosses it.
    diagram.addArea({ id: "area-2", name: "area 2", x: 400, y: 100, width: 120, height: 150 });

    seedRelationship(diagram, "posts", "users");

    const wrapper = mountCanvas(pinia);

    const path = wrapper
      .find('[data-testid="relationship-rel-1"]')
      .find("path.ddb-canvas-relationship__line")
      .attributes("d");
    assert.ok(path?.includes("L"), `expected a detour polyline, got: ${path}`);
  });
});
