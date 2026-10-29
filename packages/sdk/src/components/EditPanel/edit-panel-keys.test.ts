import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useUIStore } from "../../stores/ui.ts";

/**
 * Creating keys from the edit panel: a unique key asks for its name first, a
 * foreign key also asks for the table it points at and the column pairs it
 * joins, an index asks for its name and its columns (review of 2026-10-29).
 */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();
  const users = createTable({ id: "t_users", name: "users", logicalName: "User", x: 0, y: 0 });
  users.fields = [
    { id: "f_id", name: "id", fieldType: { type: "INT" }, fieldTypeSource: "mapped", primary: true },
    { id: "f_email", name: "email", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
    { id: "f_name", name: "name", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
  ];
  const orders = createTable({ id: "t_orders", name: "orders", x: 400, y: 0 });
  orders.fields = [
    { id: "o_id", name: "id", fieldType: { type: "INT" }, fieldTypeSource: "mapped" },
    { id: "o_email", name: "email", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
    { id: "o_name", name: "name", fieldType: { type: "VARCHAR" }, fieldTypeSource: "explicit" },
  ];
  diagram.tables = [users, orders];
  diagram.relationships = [
    {
      id: "r1",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_orders",
      endFieldId: "o_id",
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
  useUIStore().selectTable("t_users");
  const wrapper = mount(EditPanel, { global: { plugins: [pinia] } });
  return { wrapper, diagram };
}

function usersOf(diagram: ReturnType<typeof useDiagramStore>): Table {
  const found = diagram.diagram.tables.find((item) => item.id === "t_users");
  assert.ok(found, "the users table exists");
  return found;
}

describe("creating a unique key", () => {
  it("asks for the name before it adds the key", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-unique"]').trigger("click");
    const name = wrapper.find('[data-testid="unique-create-name"]');
    assert.ok(name.exists(), "the form of a new unique key opens");
    assert.equal((name.element as HTMLInputElement).value, "UK_users");
    await name.setValue("uq_email_name");
    await wrapper.find('[data-testid="unique-create-confirm"]').trigger("click");
    const keys = usersOf(diagram).uniqueKeys ?? [];
    assert.equal(keys.at(-1)?.name, "uq_email_name");
    assert.deepEqual(keys.at(-1)?.columns, []);
  });

  it("renames the two names of a key one at a time", async () => {
    const { diagram } = mountPanel();
    diagram.addUniqueKey("t_users", {
      id: "uk_names",
      name: "uq_physical",
      logicalName: "uq_physical",
      columns: [{ fieldId: "f_email" }],
    });
    diagram.renameUniqueKey("t_users", "uk_names", { name: "uq_physical", logicalName: "uq_logical" });
    const renamed = usersOf(diagram).uniqueKeys?.[0];
    assert.equal(renamed?.logicalName, "uq_logical");
    assert.equal(renamed?.name, "uq_physical");

    diagram.renameUniqueKey("t_users", "uk_names", { name: "uq_physical_2" });
    const twice = usersOf(diagram).uniqueKeys?.[0];
    assert.equal(twice?.name, "uq_physical_2");
    assert.equal(twice?.logicalName, "uq_logical");
  });

  it("undoubtedly keeps the key flags of the fields in step with the primary key", async () => {
    const { diagram } = mountPanel();
    diagram.setPrimaryColumns("t_users", [{ fieldId: "f_email" }], "PRIMARY");
    assert.equal(usersOf(diagram).fields.find((field) => field.id === "f_email")?.primary, true);
    assert.equal(usersOf(diagram).fields.find((field) => field.id === "f_id")?.primary, false);
    assert.deepEqual(usersOf(diagram).primaryKey?.columns, [{ fieldId: "f_email" }]);
  });

  it("creates nothing when the form is cancelled", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-unique"]').trigger("click");
    await wrapper.find('[data-testid="unique-create-cancel"]').trigger("click");
    assert.deepEqual(usersOf(diagram).uniqueKeys ?? [], []);
    assert.equal(wrapper.find('[data-testid="unique-create-name"]').exists(), false);
  });
});

describe("creating a foreign key", () => {
  it("takes a name, a table and the column pairs it joins", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-foreign"]').trigger("click");
    const name = wrapper.find('[data-testid="foreign-create-name"]');
    assert.ok(name.exists(), "the form of a new foreign key opens");
    await wrapper.find('[data-testid="foreign-create-target"]').setValue("t_orders");
    assert.equal((wrapper.find('[data-testid="foreign-create-name"]').element as HTMLInputElement).value, "fk_users_orders");
    await wrapper.find('[data-testid="foreign-create-add-pair"]').trigger("click");
    await wrapper.find('[data-testid="foreign-create-local-0"]').setValue("f_email");
    await wrapper.find('[data-testid="foreign-create-ref-0"]').setValue("o_email");
    await wrapper.find('[data-testid="foreign-create-confirm"]').trigger("click");
    const created = diagram.diagram.relationships.at(-1);
    assert.equal(created?.name, "fk_users_orders");
    assert.equal(created?.startTableId, "t_users");
    assert.equal(created?.endTableId, "t_orders");
    assert.equal(created?.startFieldId, "f_email");
    assert.equal(created?.endFieldId, "o_email");
    assert.deepEqual(created?.fields, [{ startFieldId: "f_email", endFieldId: "o_email" }]);
  });

  it("mirrors the first of several pairs into the four ids", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="constraint-add-foreign"]').trigger("click");
    await wrapper.find('[data-testid="foreign-create-target"]').setValue("t_orders");
    await wrapper.find('[data-testid="foreign-create-add-pair"]').trigger("click");
    await wrapper.find('[data-testid="foreign-create-local-0"]').setValue("f_email");
    await wrapper.find('[data-testid="foreign-create-ref-0"]').setValue("o_email");
    await wrapper.find('[data-testid="foreign-create-add-pair"]').trigger("click");
    await wrapper.find('[data-testid="foreign-create-local-1"]').setValue("f_name");
    await wrapper.find('[data-testid="foreign-create-ref-1"]').setValue("o_name");
    await wrapper.find('[data-testid="foreign-create-down-0"]').trigger("click");
    await wrapper.find('[data-testid="foreign-create-confirm"]').trigger("click");
    const created = diagram.diagram.relationships.at(-1);
    assert.deepEqual(created?.fields, [
      { startFieldId: "f_name", endFieldId: "o_name" },
      { startFieldId: "f_email", endFieldId: "o_email" },
    ]);
    assert.equal(created?.startFieldId, "f_name");
  });
});

describe("editing the pairs of an existing foreign key", () => {
  it("adds, orders and removes the column pairs", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="foreign-0-add-pair"]').trigger("click");
    await wrapper.find('[data-testid="foreign-0-local-1"]').setValue("f_email");
    await wrapper.find('[data-testid="foreign-0-ref-1"]').setValue("o_email");
    assert.deepEqual(diagram.diagram.relationships[0]?.fields, [
      { startFieldId: "f_id", endFieldId: "o_id" },
      { startFieldId: "f_email", endFieldId: "o_email" },
    ]);
    await wrapper.find('[data-testid="foreign-0-up-1"]').trigger("click");
    assert.deepEqual(diagram.diagram.relationships[0]?.fields, [
      { startFieldId: "f_email", endFieldId: "o_email" },
      { startFieldId: "f_id", endFieldId: "o_id" },
    ]);
    assert.equal(diagram.diagram.relationships[0]?.startFieldId, "f_email");
    await wrapper.find('[data-testid="foreign-0-remove-1"]').trigger("click");
    assert.deepEqual(diagram.diagram.relationships[0]?.fields, [
      { startFieldId: "f_email", endFieldId: "o_email" },
    ]);
  });
});

describe("creating an index", () => {
  it("asks for a name and takes several columns", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="index-create-open"]').trigger("click");
    const name = wrapper.find('[data-testid="index-create-name"]');
    assert.equal((name.element as HTMLInputElement).value, "Idx_users");
    await name.setValue("idx_users_email_name");
    await wrapper.find('[data-testid="index-create-confirm"]').trigger("click");
    const indexes = usersOf(diagram).indices ?? [];
    assert.equal(indexes.at(-1)?.name, "idx_users_email_name");
    await wrapper.find('[data-testid="index-add-field-0"]').setValue("f_email");
    await wrapper.find('[data-testid="index-add-field-0"]').setValue("f_name");
    assert.deepEqual(usersOf(diagram).indices?.[0]?.columns?.map((column) => column.fieldId), ["f_email", "f_name"]);
  });

  it("orders, removes and marks an index unique", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="index-create-open"]').trigger("click");
    await wrapper.find('[data-testid="index-create-confirm"]').trigger("click");
    await wrapper.find('[data-testid="index-add-field-0"]').setValue("f_email");
    await wrapper.find('[data-testid="index-add-field-0"]').setValue("f_name");
    await wrapper.find('[data-testid="index-field-down-0-0"]').trigger("click");
    assert.deepEqual(usersOf(diagram).indices?.[0]?.columns?.map((column) => column.fieldId), ["f_name", "f_email"]);
    await wrapper.find('[data-testid="index-field-up-0-1"]').trigger("click");
    assert.deepEqual(usersOf(diagram).indices?.[0]?.columns?.map((column) => column.fieldId), ["f_email", "f_name"]);
    await wrapper.find('[data-testid="index-remove-field-0-1"]').trigger("click");
    assert.deepEqual(usersOf(diagram).indices?.[0]?.columns?.map((column) => column.fieldId), ["f_email"]);
    await wrapper.find('[data-testid="index-unique-0"]').setValue(true);
    assert.equal(usersOf(diagram).indices?.[0]?.unique, true);
    await wrapper.find('[data-testid="index-remove-0"]').trigger("click");
    assert.deepEqual(usersOf(diagram).indices ?? [], []);
  });
});

describe("the foreign key names of the key objects (P2')", () => {
  it("moves the relationship name and the key name in one step", () => {
    const { diagram: store } = mountPanel();
    const orders = store.diagram.tables.find((table) => table.id === "t_orders");
    assert.ok(orders);
    orders.foreignKeys = [
      {
        id: "fk1",
        logicalName: "FK_orders_user",
        name: "FK_orders_user",
        relationshipId: "r1",
      },
    ];
    store.renameForeignKey("t_orders", "r1", { name: "FK_orders_buyer" });
    assert.equal(orders.foreignKeys?.[0]?.name, "FK_orders_buyer");
    assert.equal(store.diagram.relationships[0]?.name, "FK_orders_buyer");
    useHistoryStore().undo();
    assert.equal(orders.foreignKeys?.[0]?.name, "FK_orders_user");
    assert.equal(store.diagram.relationships[0]?.name, "fk_orders_user");
  });
});
