import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import SidePanel from "./SidePanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useHistoryStore } from "../../stores/history.ts";
import type { Diagram } from "@drawdb/core";

function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "postgres",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [
          { id: "f1", name: "id", type: "INTEGER", primary: true },
          { id: "f2", name: "email", type: "VARCHAR(255)", notNull: true },
        ],
      },
      { id: "t2", name: "orders", x: 300, y: 0, fields: [] },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "t1",
        startFieldId: "f1",
        endTableId: "t2",
        endFieldId: "f1",
        name: "fk_orders_user",
      },
    ],
    notes: [{ id: "n1", x: 0, y: 0, title: "hello", content: "world" }],
    subjectAreas: [{ id: "a1", name: "core", x: 0, y: 0, width: 100, height: 100 }],
    areas: [{ id: "a1", name: "core", x: 0, y: 0, width: 100, height: 100 }],
    types: [{ id: "ty1", name: "money", fields: [{ name: "amount", type: "NUMERIC" }] }],
    enums: [{ name: "state", values: ["new", "done"] }],
    views: [{ id: "v1", name: "v_users", x: 0, y: 0, width: 200 }],
    metadata: {},
  };
}

describe("SidePanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the tab bar", () => {
    const wrapper = mount(SidePanel);
    assert.ok(wrapper.find('[data-testid="tables-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="relationships-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="side-panel"]').exists());
  });

  it("lists the tables of the diagram and selects one", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);
    const item = wrapper.find('[data-testid="table-item-users"]');
    assert.ok(item.exists());
    await item.trigger("click");
    assert.deepEqual(useUIStore().selectedTableIds, ["t1"]);
  });

  it("shows the fields of the selected table", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    assert.ok(wrapper.find('[data-testid="field-row-f1"]').exists());
    assert.ok(wrapper.find('[data-testid="field-row-f2"]').exists());
  });

  it("renames a table through the panel and records it in the history", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    const input = wrapper.find('[data-testid="table-name-input"] input');
    await input.setValue("customers");
    await input.trigger("change");
    assert.equal(diagram.tableById("t1")?.name, "customers");
    assert.ok(useHistoryStore().canUndo);
  });

  it("adds a field to the selected table", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="add-field-btn"]').trigger("click");
    const table = diagram.tableById("t1");
    assert.equal(table?.fields.length, 3);
    assert.ok(useHistoryStore().canUndo);
  });

  it("removes a field from the selected table", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="remove-field-f1"]').trigger("click");
    assert.equal(diagram.tableById("t1")?.fields.length, 1);
  });

  it("toggles the primary flag of a field", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="field-primary-f2"]').trigger("click");
    assert.equal(diagram.fieldById("t1", "f2")?.primary, true);
  });

  it("deletes the selected table", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    useUIStore().selectTable("t1");
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="remove-table-btn"]').trigger("click");
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.relationships.length, 0);
  });

  it("switches to the relationships tab and lists the relationships", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="relationships-tab"]').trigger("click");
    assert.equal(useUIStore().activeTab, "relationships");
    assert.ok(wrapper.find('[data-testid="relationship-item-r1"]').exists());
  });

  it("deletes a relationship", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="relationships-tab"]').trigger("click");
    await wrapper.find('[data-testid="remove-relationship-r1"]').trigger("click");
    assert.equal(diagram.relationships.length, 0);
  });

  it("lists the notes, the areas, the enums, the views and the types", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);

    await wrapper.find('[data-testid="notes-tab"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="note-item-n1"]').exists());

    await wrapper.find('[data-testid="areas-tab"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="area-item-a1"]').exists());

    await wrapper.find('[data-testid="enums-tab"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="enum-item-state"]').exists());

    await wrapper.find('[data-testid="views-tab"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="view-item-v1"]').exists());

    await wrapper.find('[data-testid="types-tab"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="type-item-ty1"]').exists());
  });

  it("deletes a note", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);
    await wrapper.find('[data-testid="notes-tab"]').trigger("click");
    await wrapper.find('[data-testid="remove-note-n1"]').trigger("click");
    assert.equal(diagram.notes.length, 0);
  });

  it("filters the tables with the search term", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const wrapper = mount(SidePanel);
    const search = wrapper.find('[data-testid="side-panel-search"] input');
    await search.setValue("ord");
    assert.ok(!wrapper.find('[data-testid="table-item-users"]').exists());
    assert.ok(wrapper.find('[data-testid="table-item-orders"]').exists());
  });
});
