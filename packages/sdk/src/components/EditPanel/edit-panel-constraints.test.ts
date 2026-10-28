import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

/**
 * The constraints group is the editor of the primary key, the unique keys and
 * the foreign keys (issues 5 to 8). These tests drive it the way a user does:
 * typing a name, adding a column, moving one and removing a key.
 */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();
  const users = createTable({
    id: "t_users",
    name: "users",
    logicalName: "User",
    x: 0,
    y: 0,
  });
  users.fields = [
    {
      id: "f_id",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "mapped",
      primary: true,
    },
    {
      id: "f_email",
      name: "email",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "explicit",
    },
    {
      id: "f_name",
      name: "name",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "explicit",
    },
  ];
  users.uniqueConstraints = [{ id: "uk1", name: "uq_email", fields: ["f_email"] }];
  const orders = createTable({ id: "t_orders", name: "orders", x: 400, y: 0 });
  orders.fields = [
    {
      id: "f_uid",
      name: "user_id",
      fieldType: { type: "INT" },
      fieldTypeSource: "mapped",
    },
  ];
  diagram.tables = [users, orders];
  diagram.relationships = [
    {
      id: "r1",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_orders",
      endFieldId: "f_uid",
      name: "fk_orders_user",
    },
  ];
  return diagram;
}

function mountPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  diagram.setDiagram(sampleDiagram());
  const ui = useUIStore();
  ui.selectTable("t_users");
  const wrapper = mount(EditPanel, { global: { plugins: [pinia] } });
  return { wrapper, diagram };
}

function table(diagram: ReturnType<typeof useDiagramStore>, id: string): Table {
  const found = diagram.diagram.tables.find((item) => item.id === id);
  assert.ok(found, `table ${id} exists`);
  return found;
}

describe("the constraints editor", () => {
  it("adds a column to the primary key from the picker", async () => {
    const { wrapper, diagram } = mountPanel();
    const picker = wrapper.find('[data-testid="constraint-add-field-primary"]');
    await picker.setValue("f_name");
    assert.equal(table(diagram, "t_users").fields[2]?.primary, true);
  });

  it("drops a column from the primary key", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-remove-field-primary"]').trigger("click");
    assert.equal(table(diagram, "t_users").fields[0]?.primary, false);
  });

  it("renames a unique key", async () => {
    const { wrapper, diagram } = mountPanel();
    const input = wrapper.find('[data-testid="constraint-name-unique-0"]');
    await input.setValue("uq_email_name");
    assert.equal(table(diagram, "t_users").uniqueConstraints?.[0]?.name, "uq_email_name");
  });

  it("adds a unique key and gives it a name the canvas would accept", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-unique"]').trigger("click");
    const keys = table(diagram, "t_users").uniqueConstraints ?? [];
    assert.equal(keys.length, 2);
    assert.equal(keys[1]?.name, "uk_users_2");
    assert.deepEqual(keys[1]?.fields, []);
  });

  it("orders and removes the columns of a unique key", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-field-0"]').setValue("f_name");
    assert.deepEqual(table(diagram, "t_users").uniqueConstraints?.[0]?.fields, [
      "f_email",
      "f_name",
    ]);
    await wrapper.find('[data-testid="constraint-field-down-0-0"]').trigger("click");
    assert.deepEqual(table(diagram, "t_users").uniqueConstraints?.[0]?.fields, [
      "f_name",
      "f_email",
    ]);
    await wrapper.find('[data-testid="constraint-remove-field-0-1"]').trigger("click");
    assert.deepEqual(table(diagram, "t_users").uniqueConstraints?.[0]?.fields, ["f_name"]);
  });

  it("removes a unique key", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-remove-unique-0"]').trigger("click");
    assert.deepEqual(table(diagram, "t_users").uniqueConstraints, []);
  });

  it("renames a foreign key through the relationship it stands for", async () => {
    const { wrapper, diagram } = mountPanel();
    const input = wrapper.find('[data-testid="constraint-name-foreign-0"]');
    assert.ok(input.exists(), "the foreign key of the orders side");
    await input.setValue("fk_orders_owner");
    assert.equal(diagram.diagram.relationships[0]?.name, "fk_orders_owner");
  });
});
