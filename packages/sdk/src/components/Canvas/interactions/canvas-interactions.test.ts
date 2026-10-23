import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useDiagramStore } from "../../../stores/diagram.ts";
import { useUIStore } from "../../../stores/ui.ts";
import Canvas from "../Canvas.vue";
import Minimap from "../Minimap.vue";

/**
 * The canvas of the interaction layer.
 *
 * The specs mount the canvas and drive it with the events of a pointer, so
 * that the whole way from the handle to the relationship is covered.
 */

function seed(pinia: Pinia) {
  setActivePinia(pinia);
  const diagram = useDiagramStore(pinia);

  diagram.addTable({
    id: "users",
    name: "users",
    x: 40,
    y: 60,
    fields: [
      { id: "users_id", name: "id", type: "INTEGER", primary: true, notNull: true },
      { id: "users_name", name: "name", type: "VARCHAR", size: 255 },
    ],
  });

  diagram.addTable({
    id: "posts",
    name: "posts",
    x: 420,
    y: 60,
    fields: [
      { id: "posts_id", name: "id", type: "INTEGER", primary: true },
      { id: "posts_user_id", name: "user_id", type: "INTEGER" },
    ],
  });

  diagram.addTable({
    id: "profiles",
    name: "profiles",
    x: 800,
    y: 60,
    fields: [
      { id: "profiles_id", name: "id", type: "INTEGER", primary: true },
      {
        id: "profiles_user_id",
        name: "user_id",
        type: "INTEGER",
        unique: true,
      },
    ],
  });

  return diagram;
}

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

/** Dispatches a pointer event, the way a browser does. */
function fire(
  element: Element,
  type: string,
  init: {
    clientX?: number;
    clientY?: number;
    shiftKey?: boolean;
    button?: number;
  } = {},
): void {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    shiftKey: init.shiftKey ?? false,
    button: init.button ?? 0,
  });
  element.dispatchEvent(event);
}

/** Waits for the throttled pointer move of the canvas. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

function mountCanvas(pinia: Pinia) {
  return mount(Canvas, {
    props: { width: 1200, height: 800 },
    global: { plugins: [pinia] },
  });
}

describe("the canvas of the interactions", () => {
  it("renders a field handle for every field", () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountCanvas(pinia);

    const handles = wrapper.findAll('[data-testid^="field-handle-"]');
    assert.equal(handles.length, 6);
  });

  it("renders a resize handle for every table", () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountCanvas(pinia);

    const handles = wrapper.findAll('[data-testid^="resize-handle-"]');
    assert.equal(handles.length, 3);
  });

  it("dragging a field handle links the two tables", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    const target = wrapper.find(
      '[data-testid="field-handle-users-users_id"]',
    ).element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(target, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].startFieldId, "posts_user_id");
    assert.equal(diagram.relationships[0].endFieldId, "users_id");
  });

  it("releasing the link on the canvas adds no relationship", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(canvas, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 0);
  });

  it("draws the preview of a link that is being drawn", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();

    assert.equal(wrapper.findAll('[data-testid="link-preview"]').length, 1);
  });

  it("opens the menu of the right button on a table", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const ui = useUIStore(pinia);
    const wrapper = mountCanvas(pinia);

    const table = wrapper.find('[data-testid="table-users"]').element;
    fire(table, "contextmenu", { clientX: 30, clientY: 40 });
    await nextTick();

    assert.ok(ui.contextMenu);
    assert.equal(ui.contextMenu.target.kind, "table");
  });

  it("selects the tables the rectangle touches", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const ui = useUIStore(pinia);
    const wrapper = mountCanvas(pinia);

    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(canvas, "pointerdown", { clientX: 0, clientY: 0, shiftKey: true });
    fire(canvas, "pointermove", { clientX: 300, clientY: 300 });
    await settle();
    fire(canvas, "pointerup", { clientX: 300, clientY: 300 });
    await nextTick();

    assert.deepEqual([...ui.selectedTableIds], ["users"]);
  });

  it("renders the tables on the minimap", () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mount(Minimap, {
      props: { tables: diagram.tables },
      global: { plugins: [pinia] },
    });

    assert.equal(wrapper.findAll('[data-testid^="minimap-table-"]').length, 3);
    assert.equal(wrapper.find('[data-testid="minimap"]').exists(), true);
  });
});
