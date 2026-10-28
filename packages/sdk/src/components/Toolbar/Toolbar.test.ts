/**
 * Tests for the canvas toolbar (plan Task 4, design 6.0–6.8, ruling Q1).
 *
 * Six groups ship this iteration: the display mode switch, the per-table
 * view toggles, the logical/physical layer switch, the zoom and the full
 * screen, undo/redo and the file group — plus the permanent scope indicator
 * of ruling Q1. The layout and alignment groups are a TODO of this phase.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import Toolbar from "./Toolbar.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useViewStateStore } from "../../stores/view-state.ts";

function makeTable(id: string, x = 0, y = 0) {
  return { id, name: id, x, y, fields: [] } as never;
}

function makeArea(id: string, width = 400, height = 400) {
  return { id, name: id, x: 0, y: 0, width, height } as never;
}

function mountToolbar() {
  const pinia: Pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Toolbar, { global: { plugins: [pinia] } });
  return {
    wrapper,
    diagram: useDiagramStore(),
    history: useHistoryStore(),
    scope: useToolbarScopeStore(),
    ui: useUIStore(),
    viewState: useViewStateStore(),
  };
}

// —— Structure ——

test("renders the six groups and the scope indicator", () => {
  const { wrapper } = mountToolbar();
  for (const testid of [
    "toolbar-scope",
    "toolbar-display-mode",
    "toolbar-view-toggles",
    "toolbar-view-layer",
    "toolbar-zoom",
    "toolbar-undo",
    "toolbar-file-new",
  ]) {
    assert.ok(wrapper.find(`[data-testid="${testid}"]`).exists(), testid);
  }
  wrapper.unmount();
});

// —— Display mode switch (6.1) ——

test("clicking a display mode writes the canvas mode and marks it active", async () => {
  const { wrapper, viewState } = mountToolbar();
  const all = wrapper.find('[data-testid="toolbar-mode-all"]');
  assert.equal(all.attributes("aria-pressed"), undefined);

  await all.trigger("click");

  assert.equal(viewState.displayMode, "all");
  assert.equal(all.attributes("aria-pressed"), "true");
  assert.equal(
    wrapper.find('[data-testid="toolbar-mode-attributes"]').attributes(
      "aria-pressed",
    ),
    undefined,
  );
  wrapper.unmount();
});

test("a manual toggle highlights the custom state of the mode switch", async () => {
  const { wrapper, viewState } = mountToolbar();
  assert.equal(
    wrapper.find('[data-testid="toolbar-mode-custom"]').attributes(
      "aria-pressed",
    ),
    undefined,
  );

  await wrapper.find('[data-testid="toolbar-toggle-description"]').trigger("click");

  assert.equal(viewState.displayMode, "custom");
  const custom = wrapper.find('[data-testid="toolbar-mode-custom"]');
  assert.equal(custom.attributes("aria-pressed"), "true");
  // The custom state is derived (Q20): it cannot be clicked back on.
  assert.notEqual(custom.attributes("disabled"), undefined);
  wrapper.unmount();
});

// —— Per-table view toggles (6.2) ——

test("a toggle click flips the canvas toggle", async () => {
  const { wrapper, viewState } = mountToolbar();
  const description = wrapper.find('[data-testid="toolbar-toggle-description"]');
  assert.equal(viewState.toggles.description, false);

  await description.trigger("click");

  assert.equal(viewState.toggles.description, true);
  assert.equal(description.attributes("aria-pressed"), "true");
  wrapper.unmount();
});

test("a toggle with a selected table writes the override, not the canvas", async () => {
  const { wrapper, diagram, ui, scope, viewState } = mountToolbar();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");

  // fields shows globally; the click hides it for the selected table only.
  await wrapper.find('[data-testid="toolbar-toggle-fields"]').trigger("click");

  assert.deepEqual(scope.overrideFor("t1"), { fields: false });
  assert.equal(viewState.toggles.fields, true, "canvas default untouched");
  wrapper.unmount();
});

test("the indexes toggle is rendered but disabled until P2'", () => {
  const { wrapper } = mountToolbar();
  const indexes = wrapper.find('[data-testid="toolbar-toggle-indexes"]');
  assert.ok(indexes.exists());
  assert.notEqual(indexes.attributes("disabled"), undefined);
  assert.match(indexes.attributes("title") ?? "", /P2'/);
  wrapper.unmount();
});

// —— Scope indicator (Q1) ——

test("the scope indicator says canvas or the number of scoped tables", async () => {
  const { wrapper, diagram, ui } = mountToolbar();
  const indicator = () => wrapper.find('[data-testid="toolbar-scope"]');
  assert.match(indicator().text(), /Canvas/);

  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");
  await wrapper.vm.$nextTick();
  assert.match(indicator().text(), /1 table/);

  ui.clearSelection();
  await wrapper.vm.$nextTick();
  assert.match(indicator().text(), /Canvas/);
  wrapper.unmount();
});

test("a selected area scopes the indicator and the toggles to its tables", async () => {
  const { wrapper, diagram, ui, scope } = mountToolbar();
  diagram.addTable(makeTable("in", 10, 10));
  diagram.addTable(makeTable("out", 900, 900));
  diagram.addEntity("subjectAreas", makeArea("a1"));
  ui.selectArea("a1");
  await wrapper.vm.$nextTick();

  assert.match(wrapper.find('[data-testid="toolbar-scope"]').text(), /1 table/);

  await wrapper.find('[data-testid="toolbar-toggle-description"]').trigger("click");
  assert.deepEqual(scope.overrideFor("in"), { description: true });
  assert.equal(scope.overrideFor("out"), undefined);
  wrapper.unmount();
});

// —— Logical/physical layer switch (6.4) ——

test("the layer switch toggles between the physical and the logical layer", async () => {
  const { wrapper, viewState } = mountToolbar();
  assert.equal(viewState.viewLayer, "physical");

  const button = wrapper.find('[data-testid="toolbar-view-layer"]');
  await button.trigger("click");
  assert.equal(viewState.viewLayer, "logical");
  assert.match(button.attributes("title") ?? "", /physical/i);

  await button.trigger("click");
  assert.equal(viewState.viewLayer, "physical");
  wrapper.unmount();
});

// —— Zoom and full screen (6.6) ——

test("zoom in and out step the zoom and the label shows the percentage", async () => {
  const { wrapper, ui } = mountToolbar();
  assert.match(wrapper.find('[data-testid="toolbar-zoom-label"]').text(), /100%/);

  await wrapper.find('[data-testid="toolbar-zoom-in"]').trigger("click");
  assert.equal(ui.zoom, 1.1);
  assert.match(wrapper.find('[data-testid="toolbar-zoom-label"]').text(), /110%/);

  await wrapper.find('[data-testid="toolbar-zoom-out"]').trigger("click");
  await wrapper.find('[data-testid="toolbar-zoom-out"]').trigger("click");
  assert.equal(ui.zoom, 0.9);
  assert.match(wrapper.find('[data-testid="toolbar-zoom-label"]').text(), /90%/);
  wrapper.unmount();
});

test("the zoom buttons disable at the bounds", async () => {
  const { wrapper, ui } = mountToolbar();
  ui.setZoom(2.5);
  await wrapper.vm.$nextTick();
  assert.notEqual(
    wrapper.find('[data-testid="toolbar-zoom-in"]').attributes("disabled"),
    undefined,
  );

  ui.setZoom(0.25);
  await wrapper.vm.$nextTick();
  assert.notEqual(
    wrapper.find('[data-testid="toolbar-zoom-out"]').attributes("disabled"),
    undefined,
  );
  wrapper.unmount();
});

test("full screen is disabled with a reason when the API is missing", () => {
  const { wrapper } = mountToolbar();
  const button = wrapper.find('[data-testid="toolbar-fullscreen"]');
  // jsdom has no Fullscreen API: the capability probe greys the button (6.6).
  assert.notEqual(button.attributes("disabled"), undefined);
  assert.match(button.attributes("title") ?? "", /not supported/i);
  wrapper.unmount();
});

// —— Undo/redo (6.7) ——

test("undo and redo are grey while the history is empty, with the reason", () => {
  const { wrapper } = mountToolbar();
  const undo = wrapper.find('[data-testid="toolbar-undo"]');
  const redo = wrapper.find('[data-testid="toolbar-redo"]');
  assert.notEqual(undo.attributes("disabled"), undefined);
  assert.notEqual(redo.attributes("disabled"), undefined);
  assert.match(undo.attributes("title") ?? "", /nothing to undo/i);
  wrapper.unmount();
});

test("undo carries the command description and applies the undo", async () => {
  const { wrapper, diagram, history } = mountToolbar();
  diagram.addTable(makeTable("customers"));
  await wrapper.vm.$nextTick();

  const undo = wrapper.find('[data-testid="toolbar-undo"]');
  assert.equal(undo.attributes("disabled"), undefined);
  const title = undo.attributes("title") ?? "";
  assert.ok(history.undoDescription, "a description exists");
  assert.ok(
    title.includes(history.undoDescription!),
    `the tooltip carries the description: ${title}`,
  );

  await undo.trigger("click");
  assert.equal(diagram.diagram.tables.length, 0);

  const redo = wrapper.find('[data-testid="toolbar-redo"]');
  assert.equal(redo.attributes("disabled"), undefined);
  await redo.trigger("click");
  assert.equal(diagram.diagram.tables.length, 1);
  wrapper.unmount();
});

// —— File group (6.8) ——

test("the file buttons emit the menu keys for the host", async () => {
  const { wrapper } = mountToolbar();
  await wrapper.find('[data-testid="toolbar-file-new"]').trigger("click");
  await wrapper.find('[data-testid="toolbar-file-open"]').trigger("click");
  await wrapper.find('[data-testid="toolbar-file-save"]').trigger("click");

  assert.deepEqual(wrapper.emitted("menu"), [
    ["file:new"],
    ["file:open"],
    ["file:save"],
  ]);
  wrapper.unmount();
});
