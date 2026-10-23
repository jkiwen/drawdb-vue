import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import Table from "./Table.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The editing of a table on the canvas.
 *
 * The specs mount the table and edit it in place, so that the whole way from
 * the double click to the diagram is covered.
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
      {
        id: "users_id",
        name: "id",
        type: "INTEGER",
        primary: true,
        notNull: true,
      },
      { id: "users_name", name: "name", type: "VARCHAR", size: 255 },
      { id: "users_email", name: "email", type: "VARCHAR", size: 255 },
    ],
  });

  return diagram;
}

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

function mountTable(pinia: Pinia) {
  const diagram = useDiagramStore(pinia);
  return mount(Table, {
    props: { table: diagram.tableById("users")! },
    global: { plugins: [pinia, naive] },
  });
}

function fire(element: Element, type: string, init: Record<string, number> = {}): void {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
  });
  element.dispatchEvent(event);
}

function dblclick(element: Element): void {
  fire(element, "dblclick");
}

/**
 * A native `<input>` (the indices, the unique constraints) commits on `change`.
 *
 * An NInput writes the value of the element on `input` and commits the new
 * value of the diagram on `blur`. The helper therefore focuses the element,
 * writes the value and dispatches the sequence `input` → `change` → `blur` on
 * the element itself: NInput reads the value of `event.target`, so the handler
 * sees the value the helper wrote.
 */
function setInputValue(wrapper: ReturnType<typeof mountTable>, testid: string, value: string): void {
  const node = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(node.exists(), `${testid} should exist`);
  // NInput forwards `data-testid` to its wrapper and puts the real input
  // inside, so the element of the found node is a div for an NInput and the
  // native input for an `<input type="color">` or a `<select>`.
  const inner = node.find("input, textarea, select");
  const el = (inner.exists() ? inner.element : node.element) as HTMLInputElement;
  el.focus();
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  el.dispatchEvent(new window.Event("blur", { bubbles: false }));
}

describe("the editing of a table on the canvas", () => {
  it("renaming a table on the canvas updates the diagram", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const name = wrapper.find('[data-testid="table-name-users"]').element;
    dblclick(name);
    await nextTick();

    setInputValue(wrapper, "table-name-input-users", "accounts");
    await nextTick();
    assert.equal(diagram.tables[0].name, "accounts");
  });

  it("the name of a table is edited in place", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountTable(pinia);

    const name = wrapper.find('[data-testid="table-name-users"]').element;
    dblclick(name);
    await nextTick();

    assert.ok(wrapper.find('[data-testid="table-name-input-users"]').exists());
  });

  it("the comment of a table is edited on the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.updateTable("users", { comment: "The users of the system" });
    const wrapper = mountTable(pinia);
    await nextTick();

    const comment = wrapper.find('[data-testid="table-comment-users"]').element;
    dblclick(comment);
    await nextTick();

    setInputValue(wrapper, "table-comment-input-users", "The users of the system v2");
    await nextTick();

    assert.equal(diagram.tables[0].comment, "The users of the system v2");
  });

  it("the color of a table is changed on the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const details = wrapper.find('[data-testid="table-details-toggle-users"]');
    await details.trigger("click");
    await nextTick();

    const color = wrapper.find('[data-testid="table-color-users"]');
    assert.ok(color.exists());
    (color.element as HTMLInputElement).value = "#ff0000";
    await color.trigger("change");
    await nextTick();

    assert.equal(diagram.tables[0].color, "#ff0000");
  });

  it("the index of a table is edited on the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);
    await nextTick();

    const details = wrapper.find('[data-testid="table-details-toggle-users"]');
    await details.trigger("click");
    await nextTick();

    const addIndex = wrapper.find('[data-testid="table-add-index-users"]');
    await addIndex.trigger("click");
    await nextTick();
    await nextTick();

    setInputValue(wrapper, "table-index-name-users-0", "idx_users_email");
    await nextTick();

    assert.equal(diagram.tables[0].indices?.[0]?.name, "idx_users_email");
  });

  it("the unique constraints of a table are edited on the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);
    await nextTick();

    const details = wrapper.find('[data-testid="table-details-toggle-users"]');
    await details.trigger("click");
    await nextTick();

    const addUnique = wrapper.find('[data-testid="table-add-unique-users"]');
    await addUnique.trigger("click");
    await nextTick();
    await nextTick();

    setInputValue(wrapper, "table-unique-name-users-0", "uq_users_email");
    await nextTick();

    assert.equal(diagram.tables[0].uniqueConstraints?.[0]?.name, "uq_users_email");
  });

  it("the table can be locked from the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const lock = wrapper.find('[data-testid="table-lock-toggle-users"]');
    await lock.trigger("click");
    await nextTick();

    assert.equal(diagram.tables[0].locked, true);
  });

  it("the table can be resized from the handle", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountTable(pinia);

    const handle = wrapper.find('[data-testid="resize-handle-users"]').element;
    fire(handle, "pointerdown", { clientX: 100, clientY: 100 });
    await nextTick();

    assert.equal(
      (wrapper.vm as unknown as { resizing: boolean }).resizing,
      true,
    );
  });

  it("renaming a field on the canvas updates the diagram", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const fieldName = wrapper.find('[data-testid="field-name-users_id"]').element;
    dblclick(fieldName);
    await nextTick();

    setInputValue(wrapper, "field-name-input-users_id", "identifier");
    await nextTick();

    assert.equal(diagram.tables[0].fields[0].name, "identifier");
  });

  it("the type of a field is edited in place", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const fieldType = wrapper.find(
      '[data-testid="field-type"][data-field-id="users_name"]',
    ).element;
    dblclick(fieldType);
    await nextTick();

    setInputValue(wrapper, "field-type-input-users_name", "TEXT");
    await nextTick();

    assert.equal(diagram.tables[0].fields[1].type, "TEXT");
  });

  it("the primary key flag of a field is toggled", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const primary = wrapper.find(
      '[data-testid="field-primary"][data-field-id="users_name"]',
    );
    await primary.trigger("click");
    await nextTick();

    assert.equal(diagram.tables[0].fields[1].primary, true);
  });

  it("a field can be removed from the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const remove = wrapper.find('[data-testid="remove-field-users_email"]');
    await remove.trigger("click");
    await nextTick();

    assert.equal(diagram.tables[0].fields.length, 2);
  });

  it("every canvas edit can be undone", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountTable(pinia);

    // Rename the table.
    const name = wrapper.find('[data-testid="table-name-users"]').element;
    dblclick(name);
    await nextTick();
    setInputValue(wrapper, "table-name-input-users", "accounts");
    await nextTick();

    assert.equal(diagram.tables[0].name, "accounts");
    assert.equal(history.canUndo, true);

    history.undo();
    await nextTick();
    assert.equal(diagram.tables[0].name, "users");
  });

  it("the fields can be reordered by dragging", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountTable(pinia);

    const draggable = wrapper.findComponent({ name: "VueDraggable" });
    assert.ok(draggable.exists(), "the VueDraggable should exist");

    draggable.vm.$emit("end", { oldIndex: 0, newIndex: 1 });
    await nextTick();

    assert.equal(diagram.tables[0].fields[0].id, "users_name");
    assert.equal(diagram.tables[0].fields[1].id, "users_id");
  });
});
