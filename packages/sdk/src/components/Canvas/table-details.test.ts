import assert from "node:assert/strict";
import { test } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import type { Table as TableModel } from "@drawdb/core";
import Table from "./Table.vue";
import {
  tableDetailsHeight,
  tableHeaderHeight,
  tableHeight,
  TABLE_FIELD_HEIGHT,
} from "./geometry.ts";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import { useDiagramStore } from "../../stores/diagram.ts";

/**
 * The details of a table (its colour, its indices and its unique
 * constraints) used to open as an overlay on top of the fields, styled
 * nothing like the rest of the canvas, and the table never grew to fit
 * them. These tests pin the fix: the details sit in the flow of the table
 * body, the table height counts them, and the inputs share the edit style
 * of the canvas.
 */

function makeTable(overrides: Partial<TableModel> = {}): TableModel {
  return {
    id: "t1",
    name: "t1",
    x: 100,
    y: 200,
    fields: [
      { id: "f1", name: "id", type: "INTEGER" },
      { id: "f2", name: "name", type: "VARCHAR" },
    ],
    ...overrides,
  } as TableModel;
}

function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  diagram.addTable({
    id: "users",
    name: "users",
    x: 40,
    y: 60,
    width: 220,
    fields: [
      { id: "users_id", name: "id", type: "INT", primary: true, notNull: true },
      { id: "users_email", name: "email", type: "VARCHAR(255)", notNull: true },
    ],
    indices: [{ id: "idx_users_email", name: "idx_users_email", unique: false, fields: ["email"] }],
    uniqueConstraints: [{ id: "uq_users_email", name: "uq_users_email", fields: ["email"] }],
    locked: false,
  });
  const table = diagram.tableById("users");
  assert.ok(table);
  const wrapper = mount(Table, {
    props: { table, selected: false, showFieldTypes: true },
    global: { plugins: [pinia, naive] },
    attachTo: document.body,
  });
  return { diagram, wrapper };
}

test("the height of a table grows with the details it shows", () => {
  const closed = makeTable();
  const open = makeTable({
    details: true,
    indices: [{ name: "idx_email", unique: false, fields: ["email"] }],
    uniqueConstraints: [{ name: "uq_email", fields: ["email"] }],
  });
  assert.equal(tableDetailsHeight(closed), 0);
  assert.equal(tableDetailsHeight(open), 148 + 2 * 28);
  assert.equal(tableHeight(closed), tableHeaderHeight(closed) + 2 * TABLE_FIELD_HEIGHT);
  assert.equal(
    tableHeight(open),
    tableHeaderHeight(open) + 2 * TABLE_FIELD_HEIGHT + tableDetailsHeight(open),
  );
});

test("the details sit inside the body of the table, not over the fields", async () => {
  const { wrapper } = setup();
  await wrapper.find('[data-testid="table-details-toggle-users"]').trigger("click");
  await nextTick();
  const details = wrapper.find('[data-testid="table-details-users"]');
  assert.ok(details.exists(), "the details of the table are not rendered");
  assert.equal(
    details.element.closest(".ddb-table__header"),
    null,
    "the details must not sit inside the header",
  );
  assert.ok(
    details.element.closest(".ddb-table__body"),
    "the details must sit in the flow of the body",
  );
});

test("the table grows to fit its details", async () => {
  const { diagram, wrapper } = setup();
  const before = Number(wrapper.find("foreignObject").attributes("height"));
  await wrapper.find('[data-testid="table-details-toggle-users"]').trigger("click");
  await nextTick();
  const table = diagram.tableById("users");
  assert.ok(table);
  assert.equal(table.details, true, "the details stay in the state of the table");
  const after = Number(wrapper.find("foreignObject").attributes("height"));
  assert.equal(after, tableHeight(table), "the table does not fit its details");
  assert.ok(after > before, "the table did not grow when its details opened");
});

test("the inputs of the details share the edit style of the canvas", async () => {
  const { wrapper } = setup();
  await wrapper.find('[data-testid="table-details-toggle-users"]').trigger("click");
  await nextTick();
  const nameInput = wrapper.find('[data-testid="table-index-name-users-0"]');
  assert.ok(nameInput.exists(), "the index name input is not rendered");
  assert.ok(
    nameInput.classes().includes("ddb-table__details-input"),
    "the inputs of the details do not carry the edit style of the canvas",
  );
});

test("choosing a colour in the details paints the colour strip of the table", async () => {
  const { diagram, wrapper } = setup();
  await wrapper.find('[data-testid="table-details-toggle-users"]').trigger("click");
  await nextTick();
  const color = wrapper.find('[data-testid="table-color-users"]');
  assert.ok(color.exists(), "the colour input is not rendered");
  (color.element as HTMLInputElement).value = "#ff0000";
  await color.trigger("change");
  await nextTick();
  const table = diagram.tableById("users");
  assert.ok(table);
  assert.equal(table.color, "#ff0000", "the colour never reached the state");
  const strip = wrapper.find(".ddb-table__color-strip");
  assert.ok(strip.exists(), "the colour strip is not rendered");
  const background = (strip.element as HTMLElement).style.background;
  assert.ok(
    background.includes("rgb(255, 0, 0)") || background.includes("#ff0000"),
    `the colour strip does not show the colour of the table (background: "${background}")`,
  );
});

test("a locked table can show its details but cannot change them", async () => {
  const { diagram, wrapper } = setup();
  diagram.toggleTableLock("users");
  await nextTick();
  await wrapper.find('[data-testid="table-details-toggle-users"]').trigger("click");
  await nextTick();
  const details = wrapper.find('[data-testid="table-details-users"]');
  assert.ok(details.exists(), "a locked table cannot show its details");
  const color = wrapper.find('[data-testid="table-color-users"]');
  assert.equal(
    (color.element as HTMLInputElement).disabled,
    true,
    "the colour of a locked table stays editable",
  );
  assert.equal(
    wrapper.find('[data-testid="table-add-index-users"]').exists(),
    false,
    "a locked table can still add indices",
  );
});
