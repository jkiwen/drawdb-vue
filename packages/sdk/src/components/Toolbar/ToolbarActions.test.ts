/**
 * Tests for the groups the canvas toolbar took over from the header row
 * (issue 11): creating elements, undo and redo, zoom and the canvas view.
 *
 * The test ids are the ones the header row used, so the hosts and the
 * end-to-end specs stayed on the same contract while the buttons moved.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { nextTick } from "vue";
import Toolbar from "./Toolbar.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useSettingsStore } from "../../stores/settings.ts";

function mountToolbar() {
  const pinia: Pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Toolbar, { global: { plugins: [pinia] } });
  return {
    wrapper,
    diagram: useDiagramStore(),
    ui: useUIStore(),
  };
}

function isDisabled(
  wrapper: ReturnType<typeof mountToolbar>["wrapper"],
  testId: string,
): boolean {
  const attributes = wrapper.find(`[data-testid="${testId}"]`).attributes();
  return attributes.disabled !== undefined;
}

test("the toolbar creates tables, notes and areas", async () => {
  const { wrapper, diagram } = mountToolbar();

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
  const { wrapper, diagram, ui } = mountToolbar();

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await nextTick();

  assert.deepEqual(
    diagram.tables.map((table) => table.name),
    ["table", "table_1"],
  );
  assert.equal(ui.selectedTableIds.length, 1);
  assert.equal(ui.selectedTableIds[0], String(diagram.tables[1]!.id));
  wrapper.unmount();
});

test("undo and redo are disabled while the history is empty", () => {
  const { wrapper } = mountToolbar();

  assert.equal(isDisabled(wrapper, "undo-btn"), true);
  assert.equal(isDisabled(wrapper, "redo-btn"), true);
  wrapper.unmount();
});

test("undo becomes available after a change and applies it", async () => {
  const { wrapper, diagram } = mountToolbar();

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

test("the zoom buttons change the zoom of the canvas", async () => {
  const { wrapper, ui } = mountToolbar();

  await wrapper.find('[data-testid="zoom-in-btn"]').trigger("click");
  await nextTick();
  assert.equal(ui.zoom, 1.1);

  await wrapper.find('[data-testid="zoom-out-btn"]').trigger("click");
  await nextTick();
  assert.equal(ui.zoom, 1);
  wrapper.unmount();
});

test("the grid and the side panel can be toggled", async () => {
  const { wrapper, ui } = mountToolbar();

  await wrapper.find('[data-testid="toggle-grid-btn"]').trigger("click");
  await wrapper.find('[data-testid="toggle-sidebar-btn"]').trigger("click");
  await nextTick();

  assert.equal(ui.showGrid, false);
  assert.equal(useSettingsStore().settings.panelLeftCollapsed, true);
  wrapper.unmount();
});
