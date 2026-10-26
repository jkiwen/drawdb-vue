import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { nextTick } from "vue";
import type { Area, Note, Table } from "@drawdb/core";
import { useDiagramStore, type DiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useUIStore } from "../../stores/ui.ts";
import Canvas from "./Canvas.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The area of the canvas.
 *
 * The specs mount the canvas and drive it with the events of a pointer, so
 * that the way from the click on an area to the size it was resized to is
 * covered: the area is selected by a click, it carries a handle in its corner
 * and the drag of that handle writes the new size into the diagram.
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
  diagram.addTable({ name: String(table.id), fields: [], ...table });
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

describe("the area of the canvas", () => {
  it("selects the area the user clicks on", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 120,
      clientY: 140,
    });
    await nextTick();

    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);
  });

  it("draws the area that is selected as selected", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown");
    await nextTick();

    const classes = wrapper.find('[data-testid="area-area-1"]').classes();
    assert.ok(classes.includes("is-selected"));
  });

  it("keeps the selection when the clicked area is not dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown");
    fire(wrapper.find('[data-testid="canvas"]').element, "pointerup");
    await nextTick();

    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);
  });

  it("does not pan the canvas when the click lands on an area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 130 });
    await settle();

    assert.equal(ui.scrollX, 0);
    assert.equal(ui.scrollY, 0);
  });

  it("clears the selected area when the canvas is clicked", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown");
    await nextTick();
    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);

    fire(wrapper.find('[data-testid="canvas"]').element, "pointerdown");
    await nextTick();

    assert.deepEqual([...ui.selectedAreaIds], []);
    assert.equal(
      wrapper.find('[data-testid="area-area-1"]').classes().includes("is-selected"),
      false,
    );
  });

  it("renders a resize handle in the corner of the area", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const handle = wrapper.find('[data-testid="area-resize-handle-area-1"]');
    assert.equal(handle.exists(), true);
    // The handles of the areas must not be taken for the handles of the tables.
    assert.equal(wrapper.findAll('[data-testid^="resize-handle-"]').length, 0);
  });

  it("resizes the area when its handle is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(canvas, "pointermove", { clientX: 560, clientY: 440 });
    await settle();
    await nextTick();
    fire(canvas, "pointerup", { clientX: 560, clientY: 440 });
    await nextTick();

    assert.equal(diagram.areas[0].width, 300);
    assert.equal(diagram.areas[0].height, 200);
  });

  it("follows the pointer while the handle of the area is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const rect = () =>
      wrapper.find('[data-testid="area-area-1"] .ddb-area__rect');

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(canvas, "pointermove", { clientX: 560, clientY: 440 });
    await settle();
    await nextTick();

    // The area follows the corner of the drag while the pointer is down, and
    // the diagram keeps the size of before the drag until the release.
    assert.equal(rect().attributes("width"), "300");
    assert.equal(rect().attributes("height"), "200");
    assert.equal(diagram.areas[0].width, 240);

    fire(canvas, "pointerup", { clientX: 560, clientY: 440 });
    await nextTick();

    assert.equal(diagram.areas[0].width, 300);
    assert.equal(rect().attributes("width"), "300");
  });

  it("applies the move that still waits for a frame when the handle is released", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    // The move is throttled to one call per frame; the release follows it in
    // the same frame, the way a quick drag ends in a browser.
    fire(canvas, "pointermove", { clientX: 560, clientY: 440 });
    fire(canvas, "pointerup", { clientX: 560, clientY: 440 });
    await nextTick();

    assert.equal(diagram.areas[0].width, 300);
    assert.equal(diagram.areas[0].height, 200);
  });

  it("undoes the resize back to the size the area had", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(canvas, "pointermove", { clientX: 560, clientY: 440 });
    await settle();
    fire(canvas, "pointerup", { clientX: 560, clientY: 440 });
    await nextTick();

    history.undo();
    await nextTick();

    assert.equal(diagram.areas[0].width, 240);
    assert.equal(diagram.areas[0].height, 160);
  });

  it("keeps the smallest size of the area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(canvas, "pointermove", { clientX: 0, clientY: 0 });
    await settle();
    fire(canvas, "pointerup", { clientX: 0, clientY: 0 });
    await nextTick();

    assert.equal(diagram.areas[0].width, 80);
    assert.equal(diagram.areas[0].height, 60);
  });

  it("leaves the size of the area alone when the handle is not dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(wrapper.find('[data-testid="area-resize-handle-area-1"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(canvas, "pointerup", { clientX: 500, clientY: 400 });
    await nextTick();

    assert.equal(diagram.areas[0].width, 240);
    assert.equal(history.depth, depth);
  });

  it("moves the area when it is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    const wrapper = mountCanvas(pinia);

    seedArea(diagram);
    await nextTick();

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const area = () => wrapper.find('[data-testid="area-area-1"]');

    fire(area().element, "pointerdown", { clientX: 100, clientY: 100 });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    await nextTick();

    // The area follows the pointer while the button is down, and the diagram
    // holds the position of the drag, which the release turns into a command.
    assert.equal(area().attributes("transform"), "translate(100 100)");
    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);

    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    assert.equal(diagram.areas[0].x, 100);
    assert.equal(diagram.areas[0].y, 100);
    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);
  });

  it("undoes the move back to the place the area had", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    seedArea(diagram);
    await nextTick();

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    assert.equal(history.depth, depth + 1);

    history.undo();
    await nextTick();

    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
  });

  it("records no move when the area is only clicked", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    seedArea(diagram);
    await nextTick();

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointerup", { clientX: 100, clientY: 100 });
    await nextTick();

    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
    assert.equal(history.depth, depth);
  });

  it("selects and resizes the area that was just added", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    const wrapper = mountCanvas(pinia);

    seedArea(diagram, { id: "area-2", name: "area 2", x: 320, y: 240 });
    await nextTick();

    const area = wrapper.find('[data-testid="area-area-2"]');
    assert.equal(area.exists(), true);

    fire(area.element, "pointerdown", { clientX: 400, clientY: 300 });
    await nextTick();
    assert.deepEqual([...ui.selectedAreaIds], ["area-2"]);

    fire(wrapper.find('[data-testid="area-resize-handle-area-2"]').element, "pointerdown", {
      clientX: 500,
      clientY: 400,
    });
    fire(wrapper.find('[data-testid="canvas"]').element, "pointermove", {
      clientX: 520,
      clientY: 430,
    });
    await settle();
    fire(wrapper.find('[data-testid="canvas"]').element, "pointerup", {
      clientX: 520,
      clientY: 430,
    });
    await nextTick();

    // The selection survived the resize, and the size of the area followed the
    // handle: the two gestures of the bug do not cancel each other out.
    assert.deepEqual([...ui.selectedAreaIds], ["area-2"]);
    const resized = diagram.areas.find((item) => String(item.id) === "area-2");
    assert.equal(resized?.width, 260);
    assert.equal(resized?.height, 190);
  });

  it("takes the table that sits in the area along when the area is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    seedTable(diagram, { id: "posts", x: 600, y: 600 });
    await nextTick();

    const wrapper = mountCanvas(pinia);
    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    await nextTick();

    // The table inside the area follows it; the one outside stays where it is.
    assert.equal(
      wrapper.find('[data-testid="table-users"]').attributes("transform"),
      "translate(120 120)",
    );
    assert.equal(
      wrapper.find('[data-testid="table-posts"]').attributes("transform"),
      "translate(600 600)",
    );

    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    assert.equal(diagram.areas[0].x, 100);
    assert.equal(diagram.areas[0].y, 100);
    assert.equal(diagram.tableById("users")?.x, 120);
    assert.equal(diagram.tableById("users")?.y, 120);
    // The area and the table it carries are one entry of the history.
    assert.equal(history.depth, depth + 1);

    history.undo();
    await nextTick();

    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
    assert.equal(diagram.tableById("users")?.x, 60);
    assert.equal(diagram.tableById("users")?.y, 80);
  });

  it("leaves the table alone once it is dragged out of the area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    await nextTick();

    const wrapper = mountCanvas(pinia);
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    // The table is dragged far away from the area first.
    fire(wrapper.find('[data-testid="table-users"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 560, clientY: 600 });
    await settle();
    fire(canvas, "pointerup", { clientX: 560, clientY: 600 });
    await nextTick();
    assert.equal(diagram.tableById("users")?.x, 520);

    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    // The relation is the place of the table, not a field: a table that left
    // the area is not dragged with it any more.
    assert.equal(diagram.areas[0].x, 100);
    assert.equal(diagram.tableById("users")?.x, 520);
    assert.equal(diagram.tableById("users")?.y, 580);
  });
});

describe("the collapse of an area", () => {
  it("collapses the area to its title bar when the toggle is clicked", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    const area = wrapper.find('[data-testid="area-area-1"]');
    assert.equal(diagram.areas[0].collapsed, true);
    assert.equal(area.classes().includes("is-collapsed"), true);
    // The area keeps the size it had in the diagram and draws the title bar.
    assert.equal(diagram.areas[0].height, 160);
    assert.equal(
      area.find(".ddb-area__rect").attributes("height"),
      "28",
    );
    // A collapsed area has no corner to resize.
    assert.equal(
      wrapper.find('[data-testid="area-resize-handle-area-1"]').exists(),
      false,
    );
  });

  it("expands the area back when the toggle is clicked again", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const toggle = () => wrapper.find('[data-testid="area-toggle-area-1"]');
    fire(toggle().element, "click");
    await nextTick();
    fire(toggle().element, "click");
    await nextTick();

    assert.equal(diagram.areas[0].collapsed, false);
    const area = wrapper.find('[data-testid="area-area-1"]');
    assert.equal(area.classes().includes("is-collapsed"), false);
    assert.equal(area.find(".ddb-area__rect").attributes("height"), "160");
    assert.equal(
      wrapper.find('[data-testid="area-resize-handle-area-1"]').exists(),
      true,
    );
  });

  it("collapses every area on its own", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedArea(diagram, { id: "area-2", name: "area 2", x: 400, y: 400 });
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(diagram.areas[0].collapsed, true);
    assert.equal(diagram.areas[1].collapsed ?? false, false);
    assert.equal(
      wrapper
        .find('[data-testid="area-area-2"] .ddb-area__rect')
        .attributes("height"),
      "160",
    );
  });

  it("undoes the collapse back to the expanded area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();
    assert.equal(diagram.areas[0].collapsed, true);

    history.undo();
    await nextTick();

    // The undo restores the value the area had: no collapse at all.
    assert.equal(diagram.areas[0].collapsed ?? false, false);
    assert.equal(
      wrapper
        .find('[data-testid="area-area-1"] .ddb-area__rect')
        .attributes("height"),
      "160",
    );
  });

  it("does not drag the area when the toggle is pressed", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const history = useHistoryStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "pointerdown", {
      clientX: 260,
      clientY: 70,
    });
    fire(canvas, "pointermove", { clientX: 320, clientY: 110 });
    await settle();
    fire(canvas, "pointerup", { clientX: 320, clientY: 110 });
    await nextTick();

    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
    assert.equal(history.depth, depth);
  });

  it("hides the tables and the notes the collapsed area holds", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    seedTable(diagram, { id: "posts", x: 600, y: 600 });
    diagram.addEntity("notes", {
      id: "note1",
      title: "Note",
      content: "Something to remember",
      x: 80,
      y: 100,
      width: 220,
      height: 120,
    } as Note);
    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="table-users"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="note-note1"]').exists(), true);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    // The contents of the area fold with it; the table outside stays.
    assert.equal(wrapper.find('[data-testid="table-users"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="note-note1"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="table-posts"]').exists(), true);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="table-users"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="note-note1"]').exists(), true);
  });

  it("counts the relationships of a collapsed area on a badge", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    diagram.addTable({
      id: "users",
      name: "users",
      x: 60,
      y: 80,
      fields: [{ id: "users_id", name: "id", type: "INTEGER", primary: true }],
    });
    diagram.addTable({
      id: "posts",
      name: "posts",
      x: 600,
      y: 600,
      fields: [
        { id: "posts_id", name: "id", type: "INTEGER", primary: true },
        { id: "posts_user_id", name: "user_id", type: "INTEGER" },
      ],
    });
    diagram.addRelationship({
      id: "rel-1",
      name: "posts_users",
      startTableId: "posts",
      endTableId: "users",
      startFieldId: "posts_user_id",
      endFieldId: "users_id",
      cardinality: "many_to_one",
    });
    const wrapper = mountCanvas(pinia);

    // The relationship is drawn while the area is expanded.
    assert.equal(wrapper.find('[data-testid="area-link-badge-area-1"]').exists(), false);

    fire(wrapper.find('[data-testid="area-toggle-area-1"]').element, "click");
    await nextTick();

    // The relationship folds with the area; the badge counts it.
    const badge = wrapper.find('[data-testid="area-link-badge-area-1"]');
    assert.equal(badge.exists(), true);
    assert.match(badge.text(), /1/);
    // The dashed line to the table outside only shows on the hover.
    assert.equal(wrapper.findAll(".ddb-area__link-ghost").length, 0);

    fire(badge.element, "pointerenter");
    await nextTick();
    assert.equal(wrapper.findAll(".ddb-area__link-ghost").length, 1);

    fire(badge.element, "pointerleave");
    await nextTick();
    assert.equal(wrapper.findAll(".ddb-area__link-ghost").length, 0);
  });
});

describe("the lock of an area", () => {
  it("locks the area when the lock is clicked, and unlocks it again", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-lock-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(diagram.areas[0].locked, true);
    assert.equal(
      wrapper.find('[data-testid="area-area-1"]').classes().includes("is-locked"),
      true,
    );
    // A locked area has no corner to resize.
    assert.equal(
      wrapper.find('[data-testid="area-resize-handle-area-1"]').exists(),
      false,
    );

    fire(wrapper.find('[data-testid="area-lock-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(diagram.areas[0].locked, false);
    assert.equal(
      wrapper.find('[data-testid="area-resize-handle-area-1"]').exists(),
      true,
    );
  });

  it("does not move the locked area when it is dragged", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    const ui = useUIStore(pinia);
    seedArea(diagram, { locked: true });
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const canvas = wrapper.find('[data-testid="canvas"]').element;
    fire(wrapper.find('[data-testid="area-area-1"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    // The click still selects the area, but the area does not move.
    assert.deepEqual([...ui.selectedAreaIds], ["area-1"]);
    assert.equal(diagram.areas[0].x, 40);
    assert.equal(diagram.areas[0].y, 60);
  });

  it("locks the tables the locked area holds", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    seedTable(diagram, { id: "users", x: 60, y: 80 });
    seedTable(diagram, { id: "posts", x: 600, y: 600 });
    const wrapper = mountCanvas(pinia);
    await nextTick();

    fire(wrapper.find('[data-testid="area-lock-toggle-area-1"]').element, "click");
    await nextTick();

    // The table inside the locked area reads as locked; the one outside does not.
    assert.equal(diagram.isLocked("users"), true);
    assert.equal(diagram.isLocked("posts"), false);
    assert.equal(
      wrapper.find('[data-testid="table-users"]').classes().includes("is-locked"),
      true,
    );

    // The table inside does not move when it is dragged.
    const canvas = wrapper.find('[data-testid="canvas"]').element;
    fire(wrapper.find('[data-testid="table-users"]').element, "pointerdown", {
      clientX: 100,
      clientY: 100,
    });
    fire(canvas, "pointermove", { clientX: 160, clientY: 140 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 140 });
    await nextTick();

    assert.equal(diagram.tableById("users")?.x, 60);
    assert.equal(diagram.tableById("users")?.y, 80);
  });

  it("refuses the updates of a locked area but the lock itself", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram, { locked: true });

    diagram.updateArea("area-1", { name: "renamed" });
    assert.equal(diagram.areas[0].name, "area 1");

    diagram.updateArea("area-1", { locked: false });
    assert.equal(diagram.areas[0].locked, false);

    diagram.updateArea("area-1", { name: "renamed" });
    assert.equal(diagram.areas[0].name, "renamed");
  });

  it("keeps a locked area out of the delete", () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram, { locked: true });

    diagram.removeEntity("areas", "area-1");
    assert.equal(diagram.areas.length, 1);

    diagram.updateArea("area-1", { locked: false });
    diagram.removeEntity("areas", "area-1");
    assert.equal(diagram.areas.length, 0);
  });
});

describe("the details of an area", () => {
  it("opens the details panel when the pencil is clicked", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    assert.equal(wrapper.find('[data-testid="area-details-area-1"]').exists(), false);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="area-details-area-1"]').exists(), true);

    fire(wrapper.find('[data-testid="area-details-close-area-1"]').element, "click");
    await nextTick();

    assert.equal(wrapper.find('[data-testid="area-details-area-1"]').exists(), false);
  });

  it("edits the name of the area from the details panel", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const name = wrapper.find('[data-testid="area-details-name-area-1"]');
    (name.element as HTMLInputElement).value = "core domain";
    name.trigger("input");
    name.trigger("blur");
    await nextTick();

    assert.equal(diagram.areas[0].name, "core domain");
    assert.equal(
      wrapper.find('[data-testid="area-area-1"] .ddb-area__label').text(),
      "core domain",
    );
  });

  it("keeps the name and reports the rules an empty name breaks", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const name = wrapper.find('[data-testid="area-details-name-area-1"]');
    (name.element as HTMLInputElement).value = "   ";
    name.trigger("input");
    name.trigger("blur");
    await nextTick();

    assert.equal(diagram.areas[0].name, "area 1");
    assert.equal(wrapper.find('[data-testid="area-details-error-area-1"]').exists(), true);
  });

  it("recolors the area and softens the fill from the details panel", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram);
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const color = wrapper.find('[data-testid="area-details-color-area-1"]');
    (color.element as HTMLInputElement).value = "#ff0000";
    color.trigger("change");
    await nextTick();

    assert.equal(diagram.areas[0].color, "#ff0000");
    const rect = wrapper.find('[data-testid="area-area-1"] .ddb-area__rect');
    assert.equal(rect.attributes("stroke"), "#ff0000");
    assert.equal(rect.attributes("fill"), "rgba(255, 0, 0, 0.08)");

    const opacity = wrapper.find('[data-testid="area-details-opacity-area-1"]');
    (opacity.element as HTMLInputElement).value = "0.5";
    opacity.trigger("change");
    await nextTick();

    assert.equal(diagram.areas[0].opacity, 0.5);
    assert.equal(rect.attributes("fill"), "rgba(255, 0, 0, 0.5)");
  });

  it("disables the fields of the details of a locked area", async () => {
    const pinia = freshPinia();
    const diagram = useDiagramStore(pinia);
    seedArea(diagram, { locked: true });
    const wrapper = mountCanvas(pinia);

    fire(wrapper.find('[data-testid="area-details-toggle-area-1"]').element, "click");
    await nextTick();

    const name = wrapper.find('[data-testid="area-details-name-area-1"]');
    assert.equal((name.element as HTMLInputElement).disabled, true);

    // The lock also holds the store: a forced edit does not go through.
    (name.element as HTMLInputElement).value = "renamed";
    name.trigger("input");
    name.trigger("blur");
    await nextTick();
    assert.equal(diagram.areas[0].name, "area 1");
  });
});
