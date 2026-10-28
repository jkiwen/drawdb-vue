import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Component } from "vue";
import type { Diagram } from "@drawdb/core";
import Canvas from "./Canvas.vue";
import Relationship from "./Relationship.vue";
import Table from "./Table.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

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
        logical: {
          id: "l_t1",
          name: "Customer",
          description: "a person who buys",
          attributes: [
            {
              id: "a_f1",
              name: "identifier",
              logicalType: { family: "integer" },
              fieldId: "f1",
              keyRole: "primary",
              required: true,
            },
            {
              id: "a_f2",
              name: "email address",
              logicalType: { family: "string" },
              fieldId: "f2",
            },
            {
              // No logical name: the row falls back to the physical name.
              id: "a_f3",
              name: "",
              logicalType: { family: "string" },
              fieldId: "f3",
            },
          ],
        },
        fields: [
          {
            id: "f1",
            name: "id",
            fieldType: { type: "INTEGER" },
            fieldTypeSource: "explicit",
            primary: true,
            notNull: true,
          },
          {
            id: "f2",
            name: "email",
            fieldType: { type: "VARCHAR", length: 255 },
            fieldTypeSource: "explicit",
          },
          {
            id: "f3",
            name: "nickname",
            fieldType: { type: "VARCHAR", length: 64 },
            fieldTypeSource: "explicit",
          },
        ],
      },
      {
        // No logical name: the title falls back to the physical name.
        id: "t2",
        name: "orders",
        x: 320,
        y: 0,
        logical: { id: "l_t2", name: "", attributes: [] },
        fields: [{ id: "o1", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" }],
      },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "t1",
        startFieldId: "f1",
        endTableId: "t2",
        endFieldId: "o1",
        name: "fk_orders_user",
        cardinality: "one_to_many",
      },
    ],
    notes: [],
    subjectAreas: [],
    areas: [],
    types: [],
    enums: [],
    views: [
      { id: "view-1", name: "active_users", x: 0, y: 300 },
    ],
    metadata: {},
  };
}

describe("the view layer and the display modes of the canvas", () => {
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
    return mount(component, { props, global: { plugins: [pinia, naive] } });
  }

  it("defaults to the physical layer in the attributes mode", () => {
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    // The title is the physical name, the rows show the physical fields
    // with their type specifications.
    assert.equal(wrapper.find('[data-testid="table-name-t1"]').text().trim(), "users");
    assert.ok(wrapper.find('[data-testid="field-name-f1"]').exists());
    assert.equal(wrapper.find('[data-testid="field-type"]').text().trim(), "INTEGER");
    // The description and the key marks stay off until their toggle is set.
    assert.ok(!wrapper.find('[data-testid="table-comment-t1"]').exists());
    assert.ok(!wrapper.find('[data-testid="field-primary"]').exists());
  });

  it("shows the logical names and the logical types in the logical layer", () => {
    useViewStateStore().setViewLayer("logical");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.equal(wrapper.find('[data-testid="table-name-t1"]').text().trim(), "Customer");
    assert.equal(wrapper.find('[data-testid="field-name-f1"]').text().trim(), "identifier");
    assert.equal(wrapper.find('[data-testid="field-name-f2"]').text().trim(), "email address");
    const types = wrapper.findAll('[data-testid="field-type"]');
    assert.deepEqual(
      types.map((type) => type.text()),
      ["integer", "string", "string"],
    );
  });

  it("falls back to the physical name with a badge when the logical name is missing", () => {
    useViewStateStore().setViewLayer("logical");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    const row = wrapper.find('[data-testid="field-name-f3"]');
    assert.equal(row.text().trim(), "nickname");
    assert.ok(wrapper.find('[data-testid="field-name-fallback-f3"]').exists());
  });

  it("falls back to the physical title with a badge when the logical entity name is missing", () => {
    useViewStateStore().setViewLayer("logical");
    const wrapper = mountComponent(Table, { table: seed().tables[1] });
    assert.equal(wrapper.find('[data-testid="table-name-t2"]').text().trim(), "orders");
    assert.ok(wrapper.find('[data-testid="table-title-fallback-t2"]').exists());
  });

  it("shows only the title in the entity display mode", () => {
    useViewStateStore().setDisplayMode("entity");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.ok(wrapper.find('[data-testid="table-name-t1"]').exists());
    assert.ok(!wrapper.find('[data-testid="field-name-f1"]').exists());
    assert.ok(!wrapper.find('[data-testid="table-comment-t1"]').exists());
  });

  it("shows the physical comment in the definition display mode", () => {
    useViewStateStore().setDisplayMode("definition");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.equal(
      wrapper.find('[data-testid="table-comment-t1"]').text().trim(),
      "the people",
    );
    assert.ok(!wrapper.find('[data-testid="field-name-f1"]').exists());
  });

  it("shows the logical description in the definition display mode of the logical layer", () => {
    const viewState = useViewStateStore();
    viewState.setViewLayer("logical");
    viewState.setDisplayMode("definition");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.equal(
      wrapper.find('[data-testid="table-comment-t1"]').text().trim(),
      "a person who buys",
    );
  });

  it("shows the key marks in the all display mode", () => {
    useDiagramStore().setDiagram(seed());
    useViewStateStore().setDisplayMode("all");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.ok(wrapper.find('[data-testid="field-primary"]').exists());
    // The field o1 of the other table is the foreign key; here f3 of the
    // seed points nowhere, so no row carries the FK mark.
    assert.ok(!wrapper.find('[data-testid="field-foreign"]').exists());
  });

  it("marks the foreign key fields in the all display mode", () => {
    useDiagramStore().setDiagram(seed());
    useViewStateStore().setDisplayMode("all");
    const wrapper = mountComponent(Table, { table: seed().tables[1] });
    assert.ok(wrapper.find('[data-testid="field-foreign"]').exists());
  });

  it("marks the key roles of the attributes in the all display mode of the logical layer", () => {
    const viewState = useViewStateStore();
    viewState.setViewLayer("logical");
    viewState.setDisplayMode("all");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    assert.ok(wrapper.find('[data-testid="field-primary"]').exists());
    // The required attribute is not nullable, so no question mark on it.
    const rows = wrapper.findAll('[data-testid^="field-"]');
    assert.ok(rows.length > 0);
  });

  it("does not edit inline in the logical layer", () => {
    useViewStateStore().setViewLayer("logical");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    // No drag handles and no edit inputs: the canvas edits only the
    // physical layer.
    assert.ok(!wrapper.find('[data-testid^="field-drag-handle"]').exists());
    assert.ok(!wrapper.find('[data-testid^="remove-field"]').exists());
  });

  it("hides the views in the logical layer", () => {
    const viewState = useViewStateStore();
    useDiagramStore().setDiagram(seed());
    const physical = mountComponent(Canvas, {});
    assert.ok(physical.find('[data-testid="view-view-1"]').exists());

    viewState.setViewLayer("logical");
    const logical = mountComponent(Canvas, {});
    assert.ok(!logical.find('[data-testid="view-view-1"]').exists());
  });

  it("draws the same table node in both layers", () => {
    const viewState = useViewStateStore();
    useDiagramStore().setDiagram(seed());
    const physical = mountComponent(Canvas, {});
    assert.ok(physical.find('[data-testid="table-t1"]').exists());

    viewState.setViewLayer("logical");
    const logical = mountComponent(Canvas, {});
    assert.ok(logical.find('[data-testid="table-t1"]').exists());
    // The compact entity box of the old view mode is gone.
    assert.ok(!logical.find('[data-testid="logical-table-t1"]').exists());
  });

  it("keeps drawing the relationships in the logical layer", () => {
    useViewStateStore().setViewLayer("logical");
    const diagram = seed();
    const wrapper = mountComponent(Relationship, {
      relationship: diagram.relationships[0],
      startTable: diagram.tables[0],
      endTable: diagram.tables[1],
    });
    assert.ok(wrapper.find('[data-testid="relationship-r1"]').exists());
    // The cardinality stays on both ends of the relationship.
    const cardinalities = wrapper.findAll(".ddb-canvas-relationship__cardinality");
    assert.equal(cardinalities.length, 2);
    assert.equal(cardinalities[0].text().trim(), "1");
    assert.equal(cardinalities[1].text().trim(), "n");
  });

  it("derives the custom display mode from a manual toggle", () => {
    const viewState = useViewStateStore();
    assert.equal(viewState.displayMode, "attributes");
    viewState.setToggle("description", true);
    assert.equal(viewState.displayMode, "custom");
    const wrapper = mountComponent(Table, { table: seed().tables[0] });
    // Both the fields and the description show: the toggles are the only
    // source of the display.
    assert.ok(wrapper.find('[data-testid="field-name-f1"]').exists());
    assert.ok(wrapper.find('[data-testid="table-comment-t1"]').exists());
  });
});
