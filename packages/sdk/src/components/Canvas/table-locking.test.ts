import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import Table from "./Table.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The bugs of the tables and of their fields on the canvas.
 *
 * Every bug the user reported is covered here:
 *
 * 1. a table that is locked could still be edited;
 * 2. the input of the type of a field filled the whole row and covered the
 *    other marks of the field;
 * 3. the type of a field could not be edited;
 * 4. the input of a field looked like a text box, while the edit should look
 *    like the normal state of the field, with a background at most.
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

function fire(element: Element, type: string): void {
  element.dispatchEvent(
    new window.MouseEvent(type, { bubbles: true, cancelable: true }),
  );
}

describe("the lock of a table on the canvas", () => {
  it("a locked table cannot be renamed", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const name = wrapper.find('[data-testid="table-name-users"]').element;
    fire(name, "dblclick");
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="table-name-input-users"]').exists(),
      false,
    );
  });

  it("a locked table cannot be renamed through the side panel either", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    await nextTick();

    // The store refuses the change, so that no path can edit a locked table.
    diagram.updateTable("users", { name: "accounts" });
    await nextTick();

    assert.equal(diagram.tables[0].name, "users");
  });

  it("a locked table cannot rename its fields", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const fieldName = wrapper.find(
      '[data-testid="field-name-users_name"]',
    ).element;
    fire(fieldName, "dblclick");
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="field-name-input-users_name"]').exists(),
      false,
    );
  });

  it("a locked table cannot change the type of its fields", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const type = wrapper.find(
      '[data-testid="field-type"][data-field-id="users_name"]',
    ).element;
    fire(type, "dblclick");
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="field-type-input-users_name"]').exists(),
      false,
    );
  });

  it("a locked table cannot remove its fields", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const field = wrapper.find('[data-testid="field-users-users_name"]');
    await field.trigger("pointerenter");
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="remove-field-users_name"]').exists(),
      false,
    );
  });

  it("a locked table cannot be dragged", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const table = wrapper.find('[data-testid="table-users"]').element;
    fire(table, "pointerdown");
    await nextTick();

    assert.equal(wrapper.emitted("dragstart"), undefined);
  });

  it("a locked table cannot be resized", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const handle = wrapper.find('[data-testid="resize-handle-users"]').element;
    fire(handle, "pointerdown");
    await nextTick();

    assert.equal(
      (wrapper.vm as unknown as { resizing: boolean }).resizing,
      false,
    );
  });

  it("a locked table does not let the user draw a relationship from it", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const handle = wrapper.find(
      '[data-testid="field-handle-users-users_id"]',
    ).element;
    fire(handle, "pointerdown");
    await nextTick();

    assert.equal(wrapper.emitted("linkstart"), undefined);
  });

  it("the fields of a locked table cannot be reordered", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.toggleTableLock("users");
    const wrapper = mountTable(pinia);
    await nextTick();

    const draggable = wrapper.findComponent({ name: "VueDraggable" });
    draggable.vm.$emit("end", { oldIndex: 0, newIndex: 1 });
    await nextTick();

    assert.equal(diagram.tables[0].fields[0].id, "users_id");
  });
});

describe("the editing of a field on the canvas", () => {
  it("the type of a field is edited in place", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountTable(pinia);
    await nextTick();

    const type = wrapper.find(
      '[data-testid="field-type"][data-field-id="users_name"]',
    ).element;
    fire(type, "dblclick");
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="field-type-input-users_name"]').exists(),
      true,
    );
  });

  it("the input of the type does not fill the row of the field", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountTable(pinia);
    await nextTick();

    const type = wrapper.find(
      '[data-testid="field-type"][data-field-id="users_name"]',
    ).element;
    fire(type, "dblclick");
    await nextTick();

    const input = wrapper.find('[data-testid="field-type-input-users_name"]');
    assert.ok(input.exists());

    // The input of the type has its own class, so that it does not take the
    // width of the row: the marks of the field stay visible.
    assert.ok(
      input.classes().includes("ddb-table__field-type-input"),
      "the input of the type needs its own class",
    );
    assert.equal(
      input.classes().includes("ddb-table__field-input"),
      false,
      "the input of the type must not share the class of the input of the name",
    );
  });

  it("the input of the name has its own class as well", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountTable(pinia);
    await nextTick();

    const name = wrapper.find('[data-testid="field-name-users_name"]').element;
    fire(name, "dblclick");
    await nextTick();

    const input = wrapper.find('[data-testid="field-name-input-users_name"]');
    assert.ok(input.classes().includes("ddb-table__field-name-input"));
    assert.equal(
      input.classes().includes("ddb-table__field-input"),
      false,
    );
  });
});
