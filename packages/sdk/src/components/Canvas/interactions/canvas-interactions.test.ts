import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useDiagramStore } from "../../../stores/diagram.ts";
import { useHistoryStore } from "../../../stores/history.ts";
import { useUIStore } from "../../../stores/ui.ts";
import Canvas from "../Canvas.vue";
import Minimap from "../Minimap.vue";
import { DEFAULT_TABLE_WIDTH } from "../geometry.ts";
import { naive } from "../../../../../../scripts/naive-ui-mock.mjs";

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
    logical: {
      id: "l_users",
      name: "users",
      attributes: [
        { id: "a_users_id", name: "id", logicalType: { family: "integer" }, fieldId: "users_id" },
        { id: "a_users_name", name: "name", logicalType: { family: "string" }, fieldId: "users_name" },
      ],
    },
    fields: [
      { id: "users_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true, notNull: true },
      { id: "users_name", name: "name", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
    ],
  });

  diagram.addTable({
    id: "posts",
    name: "posts",
    x: 420,
    y: 60,
    logical: {
      id: "l_posts",
      name: "posts",
      attributes: [
        { id: "a_posts_id", name: "id", logicalType: { family: "integer" }, fieldId: "posts_id" },
        { id: "a_posts_user_id", name: "user_id", logicalType: { family: "integer" }, fieldId: "posts_user_id" },
      ],
    },
    fields: [
      { id: "posts_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
      { id: "posts_user_id", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
    ],
  });

  diagram.addTable({
    id: "profiles",
    name: "profiles",
    x: 800,
    y: 60,
    logical: {
      id: "l_profiles",
      name: "profiles",
      attributes: [
        { id: "a_profiles_id", name: "id", logicalType: { family: "integer" }, fieldId: "profiles_id" },
        { id: "a_profiles_user_id", name: "user_id", logicalType: { family: "integer" }, fieldId: "profiles_user_id" },
      ],
    },
    fields: [
      { id: "profiles_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
      {
        id: "profiles_user_id",
        name: "user_id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "explicit",
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
    global: { plugins: [pinia, naive] },
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

  it("writes the width of a table the handle resized", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const handle = wrapper.find('[data-testid="resize-handle-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(handle, "pointerdown", { clientX: 500, clientY: 400 });
    fire(canvas, "pointermove", { clientX: 560, clientY: 440 });
    await settle();
    fire(canvas, "pointerup", { clientX: 560, clientY: 440 });
    await nextTick();

    assert.equal(diagram.tableById("users")?.width, DEFAULT_TABLE_WIDTH + 60);
  });

  it("records no resize when the handle of a table is not dragged", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    const handle = wrapper.find('[data-testid="resize-handle-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(handle, "pointerdown", { clientX: 500, clientY: 400 });
    fire(canvas, "pointerup", { clientX: 500, clientY: 400 });
    await nextTick();

    assert.equal(diagram.tableById("users")?.width, undefined);
    assert.equal(history.depth, depth);
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

  it("releasing the link on a table links it to the primary key", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    // The body of the target table, not one of its handles.
    const target = wrapper.find('[data-testid="table-users"]').element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(target, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].startTableId, "posts");
    assert.equal(diagram.relationships[0].startFieldId, "posts_user_id");
    assert.equal(diagram.relationships[0].endTableId, "users");
    // A link that ends on a table ends on its primary key.
    assert.equal(diagram.relationships[0].endFieldId, "users_id");
  });

  it("releasing the link on a row of a table links it to that field", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    const target = wrapper.find('[data-testid="field-users-users_name"]').element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(target, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].endFieldId, "users_name");
  });

  it("releasing the link on a table without a primary key links it to the first field", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    // A table without a primary key has no key to link to, but the link the
    // user drew must not disappear: the first field of the table is the end.
    diagram.addTable({
      id: "logs",
      name: "logs",
      x: 200,
      y: 420,
      logical: {
        id: "l_logs",
        name: "logs",
        attributes: [
          { id: "a_logs_message", name: "message", logicalType: { family: "string" }, fieldId: "logs_message" },
        ],
      },
      fields: [
        { id: "logs_message", name: "message", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
      ],
    });
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    const target = wrapper.find('[data-testid="table-logs"]').element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(target, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].endTableId, "logs");
    assert.equal(diagram.relationships[0].endFieldId, "logs_message");
  });

  it("undoes a relationship that a link created", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    const source = wrapper.find(
      '[data-testid="field-handle-posts-posts_user_id"]',
    ).element;
    const target = wrapper.find('[data-testid="table-users"]').element;

    fire(source, "pointerdown", { clientX: 100, clientY: 100 });
    fire(target, "pointerup", { clientX: 200, clientY: 120 });
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    history.undo();
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

  it("moves the table while the pointer drags it", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);

    const table = wrapper.find('[data-testid="table-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(table, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();
    fire(canvas, "pointermove", { clientX: 160, clientY: 130 });
    await settle();
    await nextTick();

    // The table follows the pointer, before the button is released.
    assert.equal(diagram.tableById("users")?.x, 100);
    assert.equal(diagram.tableById("users")?.y, 90);
    assert.equal(
      wrapper.find('[data-testid="table-users"]').attributes("transform"),
      "translate(100 90)",
    );

    fire(canvas, "pointerup", { clientX: 160, clientY: 130 });
    await nextTick();

    assert.equal(diagram.tableById("users")?.x, 100);
    assert.equal(diagram.tableById("users")?.y, 90);
  });

  it("undoes a drag back to the position it started at", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    const table = wrapper.find('[data-testid="table-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(table, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();
    fire(canvas, "pointermove", { clientX: 160, clientY: 130 });
    await settle();
    fire(canvas, "pointerup", { clientX: 160, clientY: 130 });
    await nextTick();

    history.undo();
    await nextTick();

    assert.equal(diagram.tableById("users")?.x, 40);
    assert.equal(diagram.tableById("users")?.y, 60);
  });

  it("commits the drag when the pointer is released outside the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    const table = wrapper.find('[data-testid="table-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;

    fire(table, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();
    fire(canvas, "pointermove", { clientX: 160, clientY: 130 });
    await settle();
    await nextTick();
    fire(document.body, "pointerup", { clientX: 160, clientY: 130 });
    await nextTick();

    // Released outside of the canvas, the move still becomes an undoable change
    // instead of a preview that the diagram keeps forever.
    assert.equal(diagram.tableById("users")?.x, 100);
    history.undo();
    await nextTick();
    assert.equal(diagram.tableById("users")?.x, 40);
  });

  it("records no move when the pointer does not drag the table", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);

    const table = wrapper.find('[data-testid="table-users"]').element;
    const canvas = wrapper.find('[data-testid="canvas"]').element;
    const depth = history.depth;

    fire(table, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();
    fire(canvas, "pointerup", { clientX: 100, clientY: 100 });
    await nextTick();

    assert.equal(diagram.tableById("users")?.x, 40);
    assert.equal(history.depth, depth);
  });

  it("renders the tables on the minimap", () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mount(Minimap, {
      props: { tables: diagram.tables },
      global: { plugins: [pinia, naive] },
    });

    assert.equal(wrapper.findAll('[data-testid^="minimap-table-"]').length, 3);
    assert.equal(wrapper.find('[data-testid="minimap"]').exists(), true);
  });
});
