import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";
import OutlineTree from "./OutlineTree.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useViewStateStore } from "../../stores/view-state.ts";

/**
 * The component side of the outline tree (plan Task 2): the count badges of
 * the first level, the filter interaction, the selection wiring to the ui
 * store and the Q15 hiding in the logical view.
 */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();
  const users = createTable({
    id: "t_users",
    name: "users",
    logicalName: "User",
    x: 10,
    y: 10,
  });
  users.fields = [
    {
      id: "f_id",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "explicit",
    },
  ];
  users.logical.attributes = [
    {
      id: "a_id",
      name: "Identifier",
      logicalType: { family: "number" },
      fieldId: "f_id",
    },
  ];
  const orders = createTable({
    id: "t_orders",
    name: "orders",
    logicalName: "Order",
    x: 500,
    y: 10,
  });
  diagram.tables = [users, orders];
  diagram.views = [{ id: "v1", name: "active_users", x: 0, y: 0 }];
  return diagram;
}

describe("OutlineTree", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useDiagramStore().setDiagram(sampleDiagram());
  });

  function mountTree() {
    return mount(OutlineTree, { global: { plugins: [pinia] } });
  }

  it("renders the categories with their count badge", () => {
    const wrapper = mountTree();
    assert.equal(
      wrapper.find('[data-testid="outline-badge-cat:tables"]').text(),
      "2",
    );
    assert.equal(
      wrapper.find('[data-testid="outline-badge-cat:views"]').text(),
      "1",
    );
  });

  it("selects a table in the ui store and emits focus on click", async () => {
    const wrapper = mountTree();
    await wrapper.find('[data-testid="outline-row-table:t_users"]').trigger("click");
    assert.deepEqual(useUIStore().selectedTableIds, ["t_users"]);
    assert.deepEqual(wrapper.emitted("focus"), [
      [{ kind: "table", id: "t_users" }],
    ]);
  });

  it("filters against both layer names and keeps the parent of a hit field", async () => {
    const wrapper = mountTree();
    const input = wrapper.find('[data-testid="outline-filter"]');
    await input.setValue("Identifier");
    // The logical attribute name matches even in the physical view; the hit
    // field brings its table along and the tree auto-expands.
    assert.ok(wrapper.find('[data-testid="outline-row-field:t_users:f_id"]').exists());
    assert.ok(!wrapper.find('[data-testid="outline-row-table:t_orders"]').exists());
    assert.ok(!wrapper.find('[data-testid="outline-badge-cat:views"]').exists());
  });

  it("shows the no-match empty state", async () => {
    const wrapper = mountTree();
    await wrapper.find('[data-testid="outline-filter"]').setValue("zzz-nothing");
    assert.ok(wrapper.find('[data-testid="outline-no-matches"]').exists());
  });

  it("hides the physical-only categories in the logical view (Q15)", async () => {
    const wrapper = mountTree();
    assert.ok(wrapper.find('[data-testid="outline-row-cat:views"]').exists());
    useViewStateStore().setViewLayer("logical");
    await nextTick();
    assert.ok(!wrapper.find('[data-testid="outline-row-cat:views"]').exists());
    // The table shows its logical name now (the row text starts with the
    // expansion caret of the toggle).
    assert.ok(
      wrapper
        .find('[data-testid="outline-row-table:t_users"]')
        .text()
        .includes("User"),
    );
  });

  it("toggles the sort between creation order and name", async () => {
    const wrapper = mountTree();
    // The row text starts with the expansion caret; strip it for the order.
    const labels = () =>
      wrapper
        .findAll('[data-testid^="outline-row-table:"]')
        .map((row) => row.text().replace(/^[▾▸\s]+/, ""));
    assert.deepEqual(labels(), ["users", "orders"]);
    await wrapper.find('[data-testid="outline-sort-toggle"]').trigger("click");
    assert.deepEqual(labels(), ["orders", "users"]);
  });

  it("reveals the node the ui store selects", async () => {
    const wrapper = mountTree();
    // The tables start collapsed; a selection from the canvas expands the
    // branch and marks the row as current.
    assert.ok(!wrapper.find('[data-testid="outline-row-field:t_users:f_id"]').exists());
    useUIStore().selectField("t_users", "f_id");
    await nextTick();
    const row = wrapper.find('[data-testid="outline-row-field:t_users:f_id"]');
    assert.ok(row.exists());
    assert.ok(row.classes().includes("outline-row--current") || row.attributes("data-current") === "true");
  });

  it("renames a table of the current layer through the context menu", async () => {
    const wrapper = mountTree();
    const row = wrapper.find('[data-testid="outline-row-table:t_users"]');
    await row.trigger("contextmenu");
    await wrapper.find('[data-testid="outline-menu-rename"]').trigger("click");
    const input = wrapper.find('[data-testid="outline-rename-input"]');
    assert.ok(input.exists());
    await input.setValue("app_users");
    await input.trigger("keydown", { key: "Enter" });
    assert.equal(useDiagramStore().tableById("t_users")?.name, "app_users");
  });

  it("deletes a field through the diagram store command", async () => {
    const wrapper = mountTree();
    // Expand the table first so the field row is rendered.
    await wrapper.find('[data-testid="outline-toggle-table:t_users"]').trigger("click");
    const row = wrapper.find('[data-testid="outline-row-field:t_users:f_id"]');
    await row.trigger("contextmenu");
    await wrapper.find('[data-testid="outline-menu-delete"]').trigger("click");
    assert.equal(useDiagramStore().tableById("t_users")?.fields.length, 0);
  });
});
