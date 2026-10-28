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
import { MAX_ZOOM, MIN_ZOOM, useUIStore } from "../../stores/ui.ts";
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

test("renders the nine groups and the scope indicator", () => {
  const { wrapper } = mountToolbar();
  for (const testid of [
    "toolbar-scope",
    "toolbar-create",
    "toolbar-display-mode",
    "toolbar-view-toggles",
    "toolbar-layout",
    "toolbar-align",
    "toolbar-view-layer",
    "toolbar-zoom",
    "toolbar-canvas-view",
    "undo-btn",
    "toolbar-file-new",
    "toolbar-config-group",
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

test("the indexes toggle flips the index block of the scope", async () => {
  const { wrapper, diagram, ui, scope, viewState } = mountToolbar();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");

  const indexes = () => wrapper.find('[data-testid="toolbar-toggle-indexes"]');
  assert.ok(indexes().exists());
  assert.equal(indexes().attributes("disabled"), undefined, "the block exists now");

  await indexes().trigger("click");
  assert.deepEqual(scope.overrideFor("t1"), { indexes: true }, "scoped to the selection");
  assert.equal(viewState.toggles.indexes, false, "canvas default untouched");

  ui.clearSelection();
  await indexes().trigger("click");
  assert.equal(viewState.toggles.indexes, true, "with no selection the canvas default flips");
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

test("zoom in and out step the zoom and the field shows the percentage", async () => {
  const { wrapper, ui } = mountToolbar();
  const field = () =>
    wrapper.find('[data-testid="toolbar-zoom-input"]').element as HTMLInputElement;
  assert.equal(field().value, "100");

  await wrapper.find('[data-testid="zoom-in-btn"]').trigger("click");
  assert.equal(ui.zoom, 1.1);
  assert.equal(field().value, "110");

  await wrapper.find('[data-testid="zoom-out-btn"]').trigger("click");
  await wrapper.find('[data-testid="zoom-out-btn"]').trigger("click");
  assert.equal(ui.zoom, 0.9);
  assert.equal(field().value, "90");
  wrapper.unmount();
});

test("the percent field applies the typed zoom and snaps a broken value back", async () => {
  const { wrapper, ui } = mountToolbar();
  const field = wrapper.find('[data-testid="toolbar-zoom-input"]');

  await field.setValue("150");
  await field.trigger("change");
  assert.equal(ui.zoom, 1.5);

  await field.setValue("nonsense");
  await field.trigger("change");
  assert.equal(ui.zoom, 1.5);
  assert.equal((field.element as HTMLInputElement).value, "150");
  wrapper.unmount();
});

test("actual size goes back to 100%", async () => {
  const { wrapper, ui } = mountToolbar();
  ui.setZoom(2);
  await wrapper.vm.$nextTick();

  await wrapper.find('[data-testid="toolbar-zoom-reset"]').trigger("click");
  assert.equal(ui.zoom, 1);
  wrapper.unmount();
});

test("the zoom buttons disable at the bounds", async () => {
  const { wrapper, ui } = mountToolbar();
  ui.setZoom(MAX_ZOOM);
  await wrapper.vm.$nextTick();
  assert.notEqual(
    wrapper.find('[data-testid="zoom-in-btn"]').attributes("disabled"),
    undefined,
  );

  ui.setZoom(MIN_ZOOM);
  await wrapper.vm.$nextTick();
  assert.notEqual(
    wrapper.find('[data-testid="zoom-out-btn"]').attributes("disabled"),
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
  const undo = wrapper.find('[data-testid="undo-btn"]');
  const redo = wrapper.find('[data-testid="redo-btn"]');
  assert.notEqual(undo.attributes("disabled"), undefined);
  assert.notEqual(redo.attributes("disabled"), undefined);
  assert.match(undo.attributes("title") ?? "", /nothing to undo/i);
  wrapper.unmount();
});

test("undo carries the command description and applies the undo", async () => {
  const { wrapper, diagram, history } = mountToolbar();
  diagram.addTable(makeTable("customers"));
  await wrapper.vm.$nextTick();

  const undo = wrapper.find('[data-testid="undo-btn"]');
  assert.equal(undo.attributes("disabled"), undefined);
  const title = undo.attributes("title") ?? "";
  assert.ok(history.undoDescription, "a description exists");
  assert.ok(
    title.includes(history.undoDescription!),
    `the tooltip carries the description: ${title}`,
  );

  await undo.trigger("click");
  assert.equal(diagram.diagram.tables.length, 0);

  const redo = wrapper.find('[data-testid="redo-btn"]');
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

// —— Layout group (6.3) ——

test("the layout group greys without a movable table and lays them out otherwise", async () => {
  const { wrapper, diagram, ui } = mountToolbar();
  const grid = () => wrapper.find('[data-testid="toolbar-layout-grid"]');
  assert.notEqual(grid().attributes("disabled"), undefined);

  diagram.setDiagram({
    ...diagram.diagram,
    tables: [
      { ...makeTable("t_a", 40, 40) as object, fields: [] },
      { ...makeTable("t_b", 300, 90) as object, fields: [], locked: true },
    ],
  } as never);
  await wrapper.vm.$nextTick();

  assert.equal(grid().attributes("disabled"), undefined);
  await grid().trigger("click");

  const [first, locked] = diagram.diagram.tables.map((table) => ({ x: table.x, y: table.y }));
  assert.deepEqual(first, { x: 0, y: 0 });
  // The locked table never moves (Q6).
  assert.deepEqual(locked, { x: 300, y: 90 });
  assert.equal(ui.selectedTableIds.length, 0);
  wrapper.unmount();
});

test("the layout applies to the selection when there is one (Q1)", async () => {
  const { wrapper, diagram, ui } = mountToolbar();
  diagram.setDiagram({
    ...diagram.diagram,
    tables: [
      { ...makeTable("t_a", 40, 40) as object, fields: [] },
      { ...makeTable("t_b", 300, 90) as object, fields: [] },
    ],
  } as never);
  ui.selectTable("t_b");
  await wrapper.vm.$nextTick();

  await wrapper.find('[data-testid="toolbar-layout-grid"]').trigger("click");

  // A single table in scope restarts the grid at the origin.
  assert.deepEqual(
    diagram.diagram.tables.map((table) => ({ x: table.x, y: table.y })),
    [{ x: 40, y: 40 }, { x: 0, y: 0 }],
  );
  wrapper.unmount();
});

// —— Alignment group (6.5) ——

test("alignment needs two targets and the reason shows in the tooltip", async () => {
  const { wrapper, diagram, ui } = mountToolbar();
  diagram.setDiagram({
    ...diagram.diagram,
    tables: [makeTable("t_a", 10, 10), makeTable("t_b", 300, 200)],
  } as never);
  await wrapper.vm.$nextTick();

  const left = () => wrapper.find('[data-testid="toolbar-align-left"]');
  assert.notEqual(left().attributes("disabled"), undefined);
  assert.match(left().attributes("title") ?? "", /two tables/);

  ui.selectTable("t_a", true);
  ui.selectTable("t_b", true);
  await wrapper.vm.$nextTick();
  assert.equal(left().attributes("disabled"), undefined);

  await left().trigger("click");
  assert.deepEqual(
    diagram.diagram.tables.map((table) => table.x),
    [10, 10],
  );
  wrapper.unmount();
});

test("distributing needs three targets", async () => {
  const { wrapper, diagram, ui } = mountToolbar();
  diagram.setDiagram({
    ...diagram.diagram,
    tables: [
      makeTable("t_a", 0, 0),
      makeTable("t_b", 100, 0),
      makeTable("t_c", 500, 0),
    ],
  } as never);
  const spread = () => wrapper.find('[data-testid="toolbar-distribute-h"]');
  await wrapper.vm.$nextTick();
  assert.notEqual(spread().attributes("disabled"), undefined);

  for (const id of ["t_a", "t_b", "t_c"]) {
    ui.selectTable(id, true);
  }
  await wrapper.vm.$nextTick();
  assert.equal(spread().attributes("disabled"), undefined);

  await spread().trigger("click");
  // 720 wide of boxes, 660 of tables: the two gaps are 30 each.
  assert.deepEqual(
    diagram.diagram.tables.map((table) => table.x),
    [0, 250, 500],
  );
  wrapper.unmount();
});

// —— File and configuration groups (6.8, 6.9) ——

test("save as, import and export emit their menu keys", async () => {
  const { wrapper } = mountToolbar();
  for (const [testid, key] of [
    ["toolbar-file-save-as", "file:saveAs"],
    ["toolbar-file-import", "file:import"],
    ["toolbar-file-export", "file:export"],
  ] as const) {
    await wrapper.find(`[data-testid="${testid}"]`).trigger("click");
    assert.deepEqual(wrapper.emitted("menu")?.at(-1), [key]);
  }
  wrapper.unmount();
});

test("the configuration group emits the open key", async () => {
  const { wrapper } = mountToolbar();
  await wrapper.find('[data-testid="toolbar-config"]').trigger("click");
  assert.deepEqual(wrapper.emitted("menu")?.at(-1), ["config:open"]);
  wrapper.unmount();
});

test("the host can hide the new groups too", () => {
  const pinia: Pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Toolbar, {
    props: { groups: ["displayMode"] },
    global: { plugins: [pinia] },
  });
  assert.ok(wrapper.find('[data-testid="toolbar-layout-grid"]').exists() === false);
  assert.ok(wrapper.find('[data-testid="toolbar-align-left"]').exists() === false);
  assert.ok(wrapper.find('[data-testid="toolbar-config"]').exists() === false);
  wrapper.unmount();
});
