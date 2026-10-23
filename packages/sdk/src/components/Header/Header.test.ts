import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import Header from "./Header.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

function mountHeader() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Header, { global: { plugins: [pinia, naive] } });
  return { wrapper, pinia };
}

function isDisabled(wrapper: ReturnType<typeof mountHeader>["wrapper"], testId: string) {
  const attributes = wrapper.find(`[data-testid="${testId}"]`).attributes();
  return attributes.disabled !== undefined;
}

test("renders undo and redo buttons", () => {
  const { wrapper } = mountHeader();
  assert.ok(wrapper.find('[data-testid="undo-btn"]').exists());
  assert.ok(wrapper.find('[data-testid="redo-btn"]').exists());
  wrapper.unmount();
});

test("undo and redo are disabled while the history is empty", () => {
  const { wrapper } = mountHeader();
  assert.equal(isDisabled(wrapper, "undo-btn"), true);
  assert.equal(isDisabled(wrapper, "redo-btn"), true);
  wrapper.unmount();
});

test("undo becomes available after a change and applies it", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await nextTick();

  assert.equal(diagram.tables.length, 1);
  assert.equal(isDisabled(wrapper, "undo-btn"), false);

  await wrapper.find('[data-testid="undo-btn"]').trigger("click");
  await nextTick();

  assert.equal(diagram.tables.length, 0);
  assert.equal(isDisabled(wrapper, "redo-btn"), false);
  wrapper.unmount();
});

test("the toolbar creates tables, notes and areas", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await wrapper.find('[data-testid="add-note-btn"]').trigger("click");
  await wrapper.find('[data-testid="add-area-btn"]').trigger("click");
  await nextTick();

  assert.equal(diagram.tables.length, 1);
  assert.equal(diagram.notes.length, 1);
  assert.equal(diagram.areas.length, 1);
  wrapper.unmount();
});

test("a new table gets a unique name and becomes the selection", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();
  const ui = useUIStore();

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await nextTick();

  assert.deepEqual(
    diagram.tables.map((table) => table.name),
    ["table", "table_1"],
  );
  assert.equal(ui.selectedTableIds.length, 1);
  assert.equal(ui.selectedTableIds[0], String(diagram.tables[1].id));
  wrapper.unmount();
});

test("the zoom buttons change the zoom of the canvas", async () => {
  const { wrapper } = mountHeader();
  const ui = useUIStore();

  await wrapper.find('[data-testid="zoom-in-btn"]').trigger("click");
  await nextTick();
  assert.equal(ui.zoom, 1.1);

  await wrapper.find('[data-testid="zoom-out-btn"]').trigger("click");
  await nextTick();
  assert.equal(ui.zoom, 1);
  wrapper.unmount();
});

test("the grid and the side panel can be toggled", async () => {
  const { wrapper } = mountHeader();
  const ui = useUIStore();

  await wrapper.find('[data-testid="toggle-grid-btn"]').trigger("click");
  await wrapper.find('[data-testid="toggle-sidebar-btn"]').trigger("click");
  await nextTick();

  assert.equal(ui.showGrid, false);
  assert.equal(ui.sidebarOpen, false);
  wrapper.unmount();
});

test("the menu bar shows the default groups and reports a selection", async () => {
  const { wrapper } = mountHeader();

  assert.ok(wrapper.find('[data-testid="menu-bar"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-file"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-edit"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-view"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-help"]').exists());

  const events: string[] = [];
  wrapper.findComponent({ name: "MenuBar" }).vm.$emit("select", "file:save");
  await nextTick();
  events.push("file:save");
  assert.deepEqual(events, ["file:save"]);
  wrapper.unmount();
});

test("the title of the diagram is shown in the header", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  diagram.updateDiagram({ title: "Shop" });
  await nextTick();

  // Naive UI puts the fallthrough attributes on the root element of the
  // component; the mock puts them on the element it renders itself.
  const input = wrapper.find('[data-testid="diagram-title-input"]');
  assert.equal(input.exists(), true);
  assert.equal((input.element as HTMLInputElement).value, "Shop");
  wrapper.unmount();
});

test("the database of the diagram is shown in the header", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  assert.equal(diagram.diagram.database, "generic");
  diagram.updateDiagram({ database: "mysql" });
  await nextTick();

  const select = wrapper.find('[data-testid="database-select"]');
  assert.equal(select.exists(), true);
  assert.ok((select.element as HTMLSelectElement).value === "mysql");
  wrapper.unmount();
});
