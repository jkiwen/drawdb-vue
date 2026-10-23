import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Component } from "vue";
import type { Diagram } from "@drawdb/core";
import Canvas from "./Canvas.vue";
import LogicalRelationship from "./LogicalRelationship.vue";
import LogicalTable from "./LogicalTable.vue";
import Relationship from "./Relationship.vue";
import Table from "./Table.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        comment: "the people",
        fields: [
          { id: "f1", name: "id", type: "INTEGER", primary: true },
          { id: "f2", name: "email", type: "VARCHAR(255)" },
        ],
      },
      { id: "t2", name: "orders", x: 320, y: 0, fields: [] },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "t1",
        startFieldId: "f1",
        endTableId: "t2",
        endFieldId: "id",
        name: "fk_orders_user",
        cardinality: "one_to_many",
      },
    ],
    notes: [],
    subjectAreas: [],
    areas: [],
    types: [],
    enums: [],
    views: [],
    metadata: {},
  };
}

describe("the view mode of the canvas", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  /**
   * Mounts a component.
   *
   * The pinia is installed as a plugin of the application, so that the stores
   * of the tree find it through the injection.
   */
  function mountComponent(component: Component, props: Record<string, unknown>) {
    return mount(component, { props, global: { plugins: [pinia] } });
  }

  it("shows the field types in the physical view", () => {
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.ok(wrapper.find('[data-testid="field-type"]').exists());
  });

  it("hides the field types in the logical view", () => {
    useUIStore().setViewMode("logical");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.ok(!wrapper.find('[data-testid="field-type"]').exists());
  });

  it("draws the entity without its fields in the logical view", () => {
    const wrapper = mountComponent(LogicalTable, { table: seed().tables[0] });
    assert.ok(wrapper.find('[data-testid="logical-table-t1"]').exists());
    assert.ok(wrapper.text().includes("users"));
    assert.ok(wrapper.text().includes("the people"));
    assert.ok(!wrapper.find('[data-testid="field-t1-f1"]').exists());
  });

  it("keeps the cardinality in the logical relationship", () => {
    const diagram = seed();
    const wrapper = mountComponent(LogicalRelationship, {
      relationship: diagram.relationships[0],
      startTable: diagram.tables[0],
      endTable: diagram.tables[1],
    });
    assert.ok(wrapper.find('[data-testid="logical-relationship-r1"]').exists());
    assert.equal(wrapper.findAll("path").length, 1);

    // The cardinality is drawn as a label on both ends of the relationship.
    // The relationship of the seed is one to many: "1" on the start, "n" on
    // the end.
    const cardinalities = wrapper.findAll(".ddb-relationship__cardinality");
    assert.equal(cardinalities.length, 2);
    assert.equal(cardinalities[0].text(), "1");
    assert.equal(cardinalities[1].text(), "n");
  });

  it("attaches the relationship to the fields in the physical view", () => {
    const diagram = seed();
    const wrapper = mountComponent(Relationship, {
      relationship: diagram.relationships[0],
      startTable: diagram.tables[0],
      endTable: diagram.tables[1],
    });
    assert.ok(wrapper.find('[data-testid="relationship-r1"]').exists());
  });

  it("draws the tables in the physical view by default", () => {
    useDiagramStore().setDiagram(seed());
    const wrapper = mountComponent(Canvas, {});
    assert.ok(wrapper.find('[data-testid="table-t1"]').exists());
    assert.ok(!wrapper.find('[data-testid="logical-table-t1"]').exists());
  });

  it("draws the entities in the logical view", () => {
    useDiagramStore().setDiagram(seed());
    useUIStore().setViewMode("logical");
    const wrapper = mountComponent(Canvas, {});
    assert.ok(wrapper.find('[data-testid="logical-table-t1"]').exists());
    assert.ok(wrapper.find('[data-testid="logical-relationship-r1"]').exists());
    assert.ok(!wrapper.find('[data-testid="table-t1"]').exists());
  });

  it("switches between the two view modes", () => {
    const ui = useUIStore();
    assert.equal(ui.viewMode, "physical");
    ui.toggleViewMode();
    assert.equal(ui.viewMode, "logical");
    ui.toggleViewMode();
    assert.equal(ui.viewMode, "physical");
  });
});
