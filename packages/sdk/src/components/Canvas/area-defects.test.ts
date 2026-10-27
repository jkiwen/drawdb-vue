import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { nextTick } from "vue";
import type { Area, Note, Table } from "@drawdb/core";
import { useDiagramStore, type DiagramStore } from "../../stores/diagram.ts";
import Canvas from "./Canvas.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The five defects the user found in the areas of the canvas.
 *
 * They are kept in a file of their own, because `area-editing.test.ts` is
 * already longer than the 300 lines the constraints of the workspace allow.
 */

const AREA: Area = {
  id: "area-1",
  name: "area 1",
  x: 40,
  y: 60,
  width: 240,
  height: 160,
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

function seedArea(diagram: DiagramStore, area: Partial<Area> = {}): Area {
  const seeded: Area = { ...AREA, ...area };
  diagram.addArea(seeded);
  return seeded;
}

function seedTable(diagram: DiagramStore, table: Pick<Table, "id" | "x" | "y">): void {
  diagram.addTable({
    name: String(table.id),
    logical: {
      id: `l_${table.id}`,
      name: String(table.id),
      attributes: [],
    },
    fields: [],
    ...table,
  });
}

function seedNote(diagram: DiagramStore, note: Partial<Note> & { id: string }): void {
  diagram.addEntity("notes", {
    title: "Note",
    content: "Something to remember",
    x: 60,
    y: 80,
    width: 220,
    height: 120,
    ...note,
  } as Note);
}

/** Dispatches a pointer event, the way a browser does. */
function fire(
  element: Element,
  type: string,
  init: { clientX?: number; clientY?: number; shiftKey?: boolean } = {},
): void {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    shiftKey: init.shiftKey ?? false,
    button: 0,
  });
  element.dispatchEvent(event);
}

/** Waits for the throttled pointer move of the canvas. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

describe("the contents of a collapsed area", () => {
  it("hides the table whose body lies in the area, not only the one whose corner does", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    // The area covers x 40..280, y 60..220.
    seedArea(diagram);
    // The table starts outside the area on the left, but its body lies in it.
    seedTable(diagram, { id: "users", x: 20, y: 80 });
    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="table-users"]').exists(), true);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    // The table folds with the area, although its corner is outside of it.
    assert.equal(wrapper.find('[data-testid="table-users"]').exists(), false);
  });

  it("hides the note whose body lies in the area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedNote(diagram, { id: "note1", x: 20, y: 80 });
    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="note-note1"]').exists(), true);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="note-note1"]').exists(), false);
  });

  it("keeps the table that lies outside of the area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "posts", x: 600, y: 600 });
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="table-posts"]').exists(), true);
  });

  it("takes the table whose body lies in the area along when the area is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 20, y: 80 });
    await nextTick();

    const wrapper = mountCanvas(pinia);
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    // The table that lies in the area follows it.
    assert.equal(diagram.tableById("users")?.x, 80);
    assert.equal(diagram.tableById("users")?.y, 120);
  });

  it("takes the note that lies in the area along when the area is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedNote(diagram, { id: "note1", x: 60, y: 80 });
    await nextTick();

    const wrapper = mountCanvas(pinia);
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    // The note follows the area, the way the tables do.
    assert.equal(diagram.notes[0].x, 120);
    assert.equal(diagram.notes[0].y, 120);
  });
});

describe("the relationship of a collapsed area", () => {
  it("folds the relationship that lies in the area with it", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    // The area covers x 40..280, y 60..220; both tables lie in it.
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    seedTable(diagram, { id: "posts", x: 160, y: 80 });
    diagram.addRelationship({
      id: "rel-1",
      name: "posts_users",
      startTableId: "posts",
      endTableId: "users",
      startFieldId: "posts_id",
      endFieldId: "users_id",
      cardinality: "many_to_one",
    });
    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="relationship-rel-1"]').exists(), true);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    // The relationship folds with the area it lies in.
    assert.equal(wrapper.find('[data-testid="relationship-rel-1"]').exists(), false);
  });

  it("keeps the relationship that reaches out of the area and counts it on the badge", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    seedTable(diagram, { id: "posts", x: 600, y: 600 });
    diagram.addRelationship({
      id: "rel-1",
      name: "posts_users",
      startTableId: "posts",
      endTableId: "users",
      startFieldId: "posts_id",
      endFieldId: "users_id",
      cardinality: "many_to_one",
    });
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    // The relationship reaches out of the area, so it stays; the badge
    // counts it, so that the user knows that it is still there.
    const badge = wrapper.find('[data-testid="area-link-badge-area-1"]');
    assert.equal(badge.exists(), true);
    assert.match(badge.text(), /1/);
  });
});

describe("the details panel of an area", () => {
  it("opens below the area, not over it", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const panel = wrapper.find('[data-testid="area-details-area-1"]');
    assert.equal(panel.exists(), true);
    // The panel hangs below the area: it starts where the area ends. The
    // area lies at y 60 and is 160 high, so its bottom edge is at y 220.
    assert.equal(Number(panel.attributes("y")), 220);
    assert.equal(Number(panel.attributes("x")), 40);
  });

  it("closes the panel when the close button is clicked", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();
    assert.equal(wrapper.find('[data-testid="area-details-area-1"]').exists(), true);

    fire(wrapper.find('[data-testid="area-details-close-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="area-details-area-1"]').exists(), false);
  });

  it("does not drag the area when the panel is pressed", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    fire(wrapper.find('[data-testid="area-details-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 300,
    });
    fire(canvas, "pointermove", { clientX: 200, clientY: 400 });
    await settle();
    fire(canvas, "pointerup", { clientX: 200, clientY: 400 });
    await nextTick();

    // The area stays where it is; the panel took the press.
    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
  });
});
