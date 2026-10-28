import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useUIStore } from "../../stores/ui.ts";

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
    { id: "f_id", name: "id", fieldType: { type: "INT" }, fieldTypeSource: "mapped" },
    {
      id: "f_name",
      name: "name",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "mapped",
    },
  ];
  users.logical.attributes = [
    { id: "a_id", name: "Identifier", logicalType: { family: "integer" }, fieldId: "f_id" },
    {
      id: "a_name",
      name: "Full name",
      logicalType: { family: "string" },
      params: { length: 100 },
      fieldId: "f_name",
    },
  ];
  const orders = createTable({
    id: "t_orders",
    name: "orders",
    logicalName: "Order",
    x: 400,
    y: 0,
  });
  diagram.tables = [users, orders];
  diagram.relationships = [
    {
      id: "r1",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_orders",
      endFieldId: "f_x",
      name: "fk_orders_user",
    },
  ];
  diagram.logicalRelationships = [{ id: "r1", name: "places" }];
  diagram.areas = [{ id: "area1", name: "Sales", x: 0, y: 0, width: 300, height: 200 }];
  return diagram;
}

function mountPanel(): {
  wrapper: VueWrapper;
  diagram: ReturnType<typeof useDiagramStore>;
  ui: ReturnType<typeof useUIStore>;
} {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  diagram.setDiagram(sampleDiagram());
  const ui = useUIStore();
  const wrapper = mount(EditPanel, { global: { plugins: [pinia] } });
  return { wrapper, diagram, ui };
}

function table(diagram: ReturnType<typeof useDiagramStore>, id: string): Table {
  const found = diagram.diagram.tables.find((item) => item.id === id);
  assert.ok(found, `table ${id} exists`);
  return found;
}

describe("EditPanel selection states", () => {
  it("shows the diagram editor with no selection", () => {
    const { wrapper } = mountPanel();
    assert.ok(wrapper.find('[data-testid="diagram-editor"]').exists());
  });

  it("shows the table editor for a selected table", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();
    assert.ok(wrapper.find('[data-testid="table-editor"]').exists());
    assert.equal(wrapper.find('[data-testid="field-overview"]').text(), "2 fields: 2 paired, 0 diverged");
    assert.equal(wrapper.findAll('[data-testid="field-row"]').length, 2);
  });

  it("shows the batch editor for two selected tables", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    ui.selectTable("t_orders", true);
    await wrapper.vm.$nextTick();
    assert.ok(wrapper.find('[data-testid="batch-editor"]').exists());
  });

  it("shows the relationship editor for a selected relationship", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectRelationship("r1");
    await wrapper.vm.$nextTick();
    const editor = wrapper.find('[data-testid="relationship-editor"]');
    assert.ok(editor.exists());
    const logical = wrapper.find<HTMLInputElement>('[data-testid="rel-logical-name"]');
    assert.equal(logical.element.value, "places");
  });

  it("shows the area editor for a selected area", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectArea("area1");
    await wrapper.vm.$nextTick();
    const input = wrapper.find<HTMLInputElement>('[data-testid="area-name"]');
    assert.ok(input.exists());
    assert.equal(input.element.value, "Sales");
  });
});

describe("EditPanel table commits", () => {
  it("renames the logical entity and the physical table on change", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const logical = wrapper.find('[data-testid="table-logical-name"]');
    await logical.setValue("Customer");
    await logical.trigger("change");
    const physical = wrapper.find('[data-testid="table-physical-name"]');
    await physical.setValue("customers");
    await physical.trigger("change");

    const updated = table(diagram, "t_users");
    assert.equal(updated.logical.name, "Customer");
    assert.equal(updated.name, "customers");
  });

  it("renames a logical attribute through the row input", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('[data-testid="logical-name-input"]');
    await inputs[1]!.setValue("Display name");
    await inputs[1]!.trigger("change");

    const attribute = table(diagram, "t_users").logical.attributes.find(
      (item) => item.id === "a_name",
    );
    assert.equal(attribute?.name, "Display name");
  });

  it("commits a physical type from the combobox and marks the pair explicit", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const typeInputs = wrapper.findAll('[data-testid="type-input"]');
    await typeInputs[0]!.setValue("BIGINT");
    await typeInputs[0]!.trigger("change");

    const field = table(diagram, "t_users").fields.find((item) => item.id === "f_id");
    assert.equal(field?.fieldType.type, "BIGINT");
    assert.equal(field?.fieldTypeSource, "explicit");
  });

  it("filters the datalist options by the typed query", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const typeInput = wrapper.findAll('[data-testid="type-input"]')[0]!;
    await typeInput.setValue("var");
    await wrapper.vm.$nextTick();
    const options = wrapper.findAll("datalist option");
    const values = options.map((option) => option.attributes("value"));
    assert.ok(values.some((value) => value === "VARCHAR"));
    assert.ok(!values.includes("INT"));
  });

  it("adds a field pair across both layers", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="add-field"]').trigger("click");

    const updated = table(diagram, "t_users");
    assert.equal(updated.fields.length, 3);
    assert.equal(updated.logical.attributes.length, 3);
    const added = updated.fields[2]!;
    assert.equal(added.fieldTypeSource, "mapped");
    const paired = updated.logical.attributes.find(
      (item) => String(item.fieldId) === String(added.id),
    );
    assert.ok(paired, "the new field pairs with a logical attribute");
  });

  it("removes a field pair across both layers", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const removeButtons = wrapper.findAll('[data-testid="remove-field"]');
    await removeButtons[0]!.trigger("click");

    const updated = table(diagram, "t_users");
    assert.equal(updated.fields.length, 1);
    assert.equal(updated.logical.attributes.length, 1);
    assert.ok(!updated.fields.some((item) => item.id === "f_id"));
    assert.ok(!updated.logical.attributes.some((item) => item.id === "a_id"));
  });
});

describe("EditPanel relationship and area commits", () => {
  it("writes the logical relationship name back through the command", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectRelationship("r1");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="rel-logical-name"]');
    await input.setValue("owns");
    await input.trigger("change");

    const logical = diagram.diagram.logicalRelationships?.find(
      (item) => item.id === "r1",
    );
    assert.equal(logical?.name, "owns");
  });

  it("renames the selected area", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectArea("area1");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="area-name"]');
    await input.setValue("Marketing");
    await input.trigger("change");

    assert.equal(diagram.diagram.areas?.[0]?.name, "Marketing");
  });
});

describe("EditPanel batch editor (Q12 atomicity)", () => {
  it("applies one comment to every selected table in a single undo step", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    ui.selectTable("t_orders", true);
    await wrapper.vm.$nextTick();

    const comment = wrapper.find('[data-testid="batch-comment"]');
    await comment.setValue("core schema");
    await wrapper.find('[data-testid="batch-apply"]').trigger("click");

    assert.equal(table(diagram, "t_users").comment, "core schema");
    assert.equal(table(diagram, "t_orders").comment, "core schema");

    const history = useHistoryStore();
    assert.ok(history.undo());
    assert.equal(table(diagram, "t_users").comment, undefined);
    assert.equal(table(diagram, "t_orders").comment, undefined);
  });

  it("applies nothing and reports inline when a selected table is locked", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    table(diagram, "t_orders").locked = true;
    ui.selectTable("t_users");
    ui.selectTable("t_orders", true);
    await wrapper.vm.$nextTick();

    const comment = wrapper.find('[data-testid="batch-comment"]');
    await comment.setValue("core schema");
    await wrapper.find('[data-testid="batch-apply"]').trigger("click");

    assert.equal(table(diagram, "t_users").comment, undefined);
    assert.equal(table(diagram, "t_orders").comment, undefined);
    assert.ok(wrapper.find('[data-testid="batch-error"]').exists());
  });
});
