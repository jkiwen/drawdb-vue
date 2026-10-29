import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
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
    {
      id: "f_id",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "mapped",
      primary: true,
    },
    {
      id: "f_name",
      name: "name",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "explicit",
    },
  ];
  users.uniqueConstraints = [{ name: "uq_name", fields: ["f_name"] }];
  users.indices = [
    { id: "i_name", name: "idx_name", unique: false, fields: ["f_name"] },
  ];
  const orders = createTable({
    id: "t_orders",
    name: "orders",
    logicalName: "Order",
    x: 400,
    y: 0,
  });
  diagram.tables = [users, orders];
  diagram.subjectAreas = [
    { id: "area1", name: "Sales", x: 0, y: 300, width: 300, height: 200 },
  ];
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

function rows(wrapper: VueWrapper, testid: string): string[] {
  return wrapper
    .findAll(`[data-testid="${testid}"]`)
    .map((node) => node.text().replace(/\s+/g, " ").trim());
}

describe("EditPanel constraint and index groups", () => {
  it("lists the primary key, the unique constraint and the foreign key", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    // Issues 5 to 7: every key of the table is editable from the panel, the
    // primary one under the name SQL gives it.
    const primary = rows(wrapper, "constraint-name-primary");
    assert.deepEqual(primary, ["PRIMARY"]);
    assert.deepEqual(rows(wrapper, "constraint-field-primary"), ["id×"]);
    const uniqueNames = wrapper.findAll('[data-testid="constraint-name-unique-0"]');
    assert.equal(uniqueNames.length, 1);
    assert.equal((uniqueNames[0]!.element as HTMLInputElement).value, "uq_name");
    assert.match(rows(wrapper, "constraint-unique-field")[0] ?? "", /name/);
    const foreignNames = wrapper.findAll('[data-testid="constraint-name-foreign-0"]');
    assert.equal(foreignNames.length, 1);
    assert.equal((foreignNames[0]!.element as HTMLInputElement).value, "fk_orders_user");
  });

  it("lists the indexes with their columns", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const indexes = rows(wrapper, "index-row");
    assert.equal(indexes.length, 1);
    assert.match(indexes[0]!, /name/);
    const name = wrapper.find('[data-testid="index-name-0"]');
    assert.ok(name.exists(), "the index row edits its name");
    assert.equal((name.element as HTMLInputElement).value, "idx_name");
  });

  it("says so when a table has no index", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_orders");
    await wrapper.vm.$nextTick();
    assert.ok(wrapper.find('[data-testid="indexes-empty"]').exists());
  });
});

describe("EditPanel appearance group", () => {
  it("writes the colour of the table", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="appearance-color"]');
    await input.setValue("#ff0000");
    await input.trigger("change");

    assert.equal(table(diagram, "t_users").color, "#ff0000");
  });

  it("toggles the lock of the table", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="appearance-locked"]').setValue(true);

    assert.equal(table(diagram, "t_users").locked, true);
  });

  it("clears the colour when the field is emptied", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="appearance-color"]');
    await input.setValue("#ff0000");
    await input.trigger("change");
    await input.setValue("");
    await input.trigger("change");

    assert.equal(table(diagram, "t_users").color, undefined);
  });

  it("ignores a value that is not a colour", async () => {
    const { wrapper, diagram, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="appearance-color"]');
    await input.setValue("not a colour");
    await input.trigger("change");

    assert.equal(table(diagram, "t_users").color, undefined);
  });
});

describe("EditPanel source badge (Q19)", () => {
  it("marks every row with the source of its physical type", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    await wrapper.vm.$nextTick();

    const badges = rows(wrapper, "source-badge");
    assert.deepEqual(badges, ["Mapped", "Explicit"]);
  });
});

describe("EditPanel diagram fallback", () => {
  it("edits the title of the diagram when nothing is selected", async () => {
    const { wrapper, diagram } = mountPanel();
    const input = wrapper.find('[data-testid="diagram-title"]');
    assert.ok(input.exists());
    await input.setValue("Sales");
    await input.trigger("blur");

    assert.equal(diagram.diagram.title, "Sales");
  });
});

describe("EditPanel mixed selection (design 4.7)", () => {
  it("lists the parts of the selection instead of an empty panel", async () => {
    const { wrapper, ui } = mountPanel();
    ui.selectTable("t_users");
    ui.selectArea("area1", true);
    await wrapper.vm.$nextTick();

    assert.ok(wrapper.find('[data-testid="edit-panel-mixed"]').exists());
    assert.deepEqual(rows(wrapper, "mixed-chip"), ["1 Tables", "1 Areas"]);
  });
});
