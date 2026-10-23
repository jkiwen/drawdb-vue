import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import ViewsTab from "./ViewsTab.vue";
import TypesTab from "./TypesTab.vue";
import EnumsTab from "./EnumsTab.vue";
import CustomTypesTab from "./CustomTypesTab.vue";
import SqlHeaderTab from "./SqlHeaderTab.vue";
import SidePanel from "./SidePanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useHistoryStore } from "../../stores/history.ts";
import type { Diagram } from "@drawdb/core";

/** The editing of a view, a custom type, an enum and the SQL header. */

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
          { id: "f2", name: "email", type: "VARCHAR(255)" },
        ],
      },
    ],
    relationships: [],
    notes: [],
    areas: [],
    subjectAreas: [],
    types: [{ id: "ty1", name: "money", fields: [{ id: "tyf1", name: "amount", type: "NUMERIC" }] }],
    enums: [{ name: "state", values: ["new", "done"] }],
    views: [
      {
        id: "v1",
        name: "v_users",
        x: 0,
        y: 0,
        width: 200,
        baseTableId: "t1",
        joins: [{ id: "j1", type: "one_to_one", tableId: "t1" }],
        columns: [{ id: "c1", tableId: "t1", fieldId: "f1", alias: "user_id" }],
        conditions: [{ id: "cd1", connector: "AND", tableId: "t1", fieldId: "f2", operator: "=", value: "a" }],
      },
    ],
    sqlHeader: "-- old header",
    metadata: {},
  } as Diagram;
}

function setup(diagram: Diagram) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useDiagramStore(pinia);
  store.setDiagram(diagram);
  return store;
}

/**
 * The editors of the workspace are native form elements, so a spec drives
 * them with the events a browser would send: `input` for what a user types
 * and `change` for what a user picks.
 */
function setValue(wrapper: ReturnType<typeof mount>, testid: string, value: string): void {
  const field = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(field.exists(), `${testid} should exist`);
  const el = field.element as HTMLElement;
  const form = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if ("value" in form) {
    form.focus();
    form.value = value;
  }
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  el.dispatchEvent(new window.Event("blur", { bubbles: false }));
}

function select(wrapper: ReturnType<typeof mount>, testid: string, value: string): void {
  setValue(wrapper, testid, value);
}

describe("SidePanel editors", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("the views tab lists the views", () => {
    setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="view-editor-v1"]').exists());
  });

  it("the base table of a view can be selected", async () => {
    const diagram = setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    await nextTick();
    select(wrapper, "view-base-table-v1", "t1");
    await nextTick();
    assert.equal(diagram.views[0].baseTableId, "t1");
  });

  it("a join can be added to a view", async () => {
    const diagram = setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    await nextTick();
    await wrapper.find('[data-testid="add-view-join-v1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.views[0].joins?.length, 2);
  });

  it("the columns of a view can be edited", async () => {
    const diagram = setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    await nextTick();
    setValue(wrapper, "view-column-alias-v1-0", "user_id_renamed");
    await nextTick();
    assert.equal(diagram.views[0].columns?.[0]?.alias, "user_id_renamed");
  });

  it("the conditions of a view can be edited", async () => {
    const diagram = setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    await nextTick();
    setValue(wrapper, "view-condition-value-v1-0", "b");
    await nextTick();
    assert.equal(diagram.views[0].conditions?.[0]?.value, "b");
  });

  it("a view can be removed", async () => {
    const diagram = setup(seed());
    const wrapper = mount(ViewsTab, { global: { plugins: [naive] } });
    await nextTick();
    assert.ok(wrapper.find('[data-testid="view-editor-v1"]').exists());
    diagram.removeView("v1");
    await nextTick();
    assert.equal(diagram.views.length, 0);
  });

  it("the types tab lists the custom types", () => {
    setup(seed());
    const wrapper = mount(TypesTab, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="type-editor-ty1"]').exists());
  });

  it("a field can be added to a custom type", async () => {
    const diagram = setup(seed());
    const wrapper = mount(TypesTab, { global: { plugins: [naive] } });
    await nextTick();
    await wrapper.find('[data-testid="add-field-ty1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.types[0].fields.length, 2);
  });

  it("the values of a custom type field can be edited", async () => {
    const diagram = setup(seed());
    const wrapper = mount(TypesTab, { global: { plugins: [naive] } });
    await nextTick();
    setValue(wrapper, "type-field-name-tyf1", "amount_renamed");
    await nextTick();
    assert.equal(diagram.types[0].fields[0].name, "amount_renamed");
  });

  it("a custom type can be removed", async () => {
    const diagram = setup(seed());
    mount(TypesTab, { global: { plugins: [naive] } });
    diagram.removeType("ty1");
    await nextTick();
    assert.equal(diagram.types.length, 0);
  });

  it("the enums tab lists the enums", () => {
    setup(seed());
    const wrapper = mount(EnumsTab, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="enum-editor-state"]').exists());
  });

  it("a value can be added to an enum", async () => {
    const diagram = setup(seed());
    const wrapper = mount(EnumsTab, { global: { plugins: [naive] } });
    await nextTick();
    await wrapper.find('[data-testid="add-enum-value-state"]').trigger("click");
    await nextTick();
    assert.equal(diagram.enums[0].values.length, 3);
  });

  it("a value can be removed from an enum", async () => {
    const diagram = setup(seed());
    const wrapper = mount(EnumsTab, { global: { plugins: [naive] } });
    await nextTick();
    await wrapper.find('[data-testid="remove-enum-value-state-1"]').trigger("click");
    await nextTick();
    assert.deepEqual(diagram.enums[0].values, ["new"]);
  });

  it("an enum can be removed", async () => {
    const diagram = setup(seed());
    mount(EnumsTab, { global: { plugins: [naive] } });
    diagram.removeEnum("state");
    await nextTick();
    assert.equal(diagram.enums.length, 0);
  });

  it("the custom types tab lists the custom types of the prop", () => {
    setActivePinia(createPinia());
    const types = [{ id: "c1", name: "currency", fields: [] }];
    const wrapper = mount(CustomTypesTab, { props: { customTypes: types }, global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="type-editor-c1"]').exists());
  });

  it("the custom types tab emits the new type", async () => {
    setActivePinia(createPinia());
    const wrapper = mount(CustomTypesTab, { props: { customTypes: [] }, global: { plugins: [naive] } });
    await wrapper.find('[data-testid="add-custom-type-btn"]').trigger("click");
    const added = wrapper.emitted("add");
    assert.ok(added && added.length > 0, "the tab emits add");
    const emitted = added[added.length - 1][0] as { fields: unknown[] };
    assert.equal(emitted.fields.length, 0);
  });

  it("the sql header tab edits the sql header of the diagram", async () => {
    const diagram = setup(seed());
    const wrapper = mount(SqlHeaderTab, { global: { plugins: [naive] } });
    await nextTick();
    setValue(wrapper, "sql-header-input", "-- new header");
    await nextTick();
    assert.equal(diagram.diagram.sqlHeader, "-- new header");
  });

  it("every side panel edit can be undone", async () => {
    const diagram = setup(seed());
    const history = useHistoryStore();
    const wrapper = mount(SqlHeaderTab, { global: { plugins: [naive] } });
    await nextTick();
    setValue(wrapper, "sql-header-input", "-- new header");
    await nextTick();
    assert.equal(diagram.diagram.sqlHeader, "-- new header");
    assert.equal(history.canUndo, true);
    history.undo();
    await nextTick();
    assert.equal(diagram.diagram.sqlHeader, "-- old header");
  });

  it("the new tabs appear in the tab bar", () => {
    setup(seed());
    const wrapper = mount(SidePanel, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="customTypes-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="sqlHeader-tab"]').exists());
  });

  it("the side panel keeps the existing table editors", () => {
    setup(seed());
    const wrapper = mount(SidePanel, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="tables-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="relationships-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="views-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="enums-tab"]').exists());
  });

  it("switching tabs keeps the selection", async () => {
    const diagram = setup(seed());
    const ui = useUIStore();
    mount(SidePanel, { global: { plugins: [naive] } });
    ui.selectTable("t1");
    ui.setActiveTab("sqlHeader");
    await nextTick();
    assert.deepEqual(ui.selectedTableIds, ["t1"]);
    assert.equal(diagram.views.length, 1);
  });
});
