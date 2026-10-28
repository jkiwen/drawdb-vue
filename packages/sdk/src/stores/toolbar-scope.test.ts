/**
 * Tests for the toolbar scope store (plan Task 4, design 6.0 and ruling Q1).
 *
 * The display tools of the toolbar apply to the selection when one exists
 * (selected tables plus the tables the selected areas hold) and to the whole
 * canvas otherwise. A scoped change lands in the per-table overrides of the
 * scope store; a canvas change lands in the view-state store.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { togglesForDisplayMode } from "@drawdb/core";
import {
  resolveToolbarScope,
  useToolbarScopeStore,
} from "./toolbar-scope.ts";
import { useDiagramStore } from "./diagram.ts";
import { useUIStore } from "./ui.ts";
import { useViewStateStore } from "./view-state.ts";

function makeTable(id: string, x = 0, y = 0) {
  return { id, name: id, x, y, fields: [] } as never;
}

function makeArea(id: string, x = 0, y = 0, width = 400, height = 400) {
  return { id, name: id, x, y, width, height } as never;
}

function makeDiagram(
  tables: ReturnType<typeof makeTable>[],
  areas: ReturnType<typeof makeArea>[] = [],
) {
  return { tables, subjectAreas: areas } as never;
}

function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return {
    diagram: useDiagramStore(),
    ui: useUIStore(),
    viewState: useViewStateStore(),
    scope: useToolbarScopeStore(),
  };
}

// —— resolveToolbarScope: the pure scope decision (plan Task 4 test list) ——

test("resolveToolbarScope is empty when nothing is selected", () => {
  const diagram = makeDiagram([makeTable("t1"), makeTable("t2")]);
  assert.deepEqual(resolveToolbarScope(diagram, [], []), []);
});

test("resolveToolbarScope returns the selected tables", () => {
  const diagram = makeDiagram([makeTable("t1"), makeTable("t2")]);
  assert.deepEqual(resolveToolbarScope(diagram, ["t2"], []), ["t2"]);
});

test("resolveToolbarScope adds the tables a selected area holds", () => {
  const diagram = makeDiagram(
    [makeTable("in", 10, 10), makeTable("out", 900, 900)],
    [makeArea("a1")],
  );
  assert.deepEqual(resolveToolbarScope(diagram, [], ["a1"]), ["in"]);
});

test("resolveToolbarScope unites and dedupes a mixed selection", () => {
  const diagram = makeDiagram(
    [makeTable("in", 10, 10), makeTable("t2", 900, 900)],
    [makeArea("a1")],
  );
  const scope = resolveToolbarScope(diagram, ["in", "t2"], ["a1"]);
  assert.deepEqual([...scope].sort(), ["in", "t2"]);
});

test("resolveToolbarScope reads the `areas` collection of an imported diagram", () => {
  const diagram = {
    tables: [makeTable("in", 10, 10)],
    areas: [makeArea("a1")],
    subjectAreas: [],
  } as never;
  assert.deepEqual(resolveToolbarScope(diagram, [], ["a1"]), ["in"]);
});

// —— The store: scoped writes versus canvas writes ——

test("a toggle without a selection writes the global view state", () => {
  const { viewState, scope } = setup();
  assert.equal(viewState.toggles.description, false);

  scope.setScopedToggle("description", true);

  assert.equal(viewState.toggles.description, true);
  // attributes preset + description is no preset, so the mode derives to custom.
  assert.equal(viewState.displayMode, "custom");
  assert.deepEqual(scope.overrides, {});
});

test("a toggle with a selected table writes a per-table override only", () => {
  const { diagram, ui, viewState, scope } = setup();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");

  scope.setScopedToggle("description", true);

  assert.equal(viewState.toggles.description, false);
  assert.deepEqual(scope.overrides, { t1: { description: true } });
});

test("scoped toggles accumulate in the override of the table", () => {
  const { diagram, ui, scope } = setup();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");

  scope.setScopedToggle("description", true);
  scope.setScopedToggle("pkUkFk", true);

  assert.deepEqual(scope.overrides, {
    t1: { description: true, pkUkFk: true },
  });
});

test("a toggle with a selected area overrides the tables the area holds", () => {
  const { diagram, ui, viewState, scope } = setup();
  diagram.addTable(makeTable("in", 10, 10));
  diagram.addTable(makeTable("out", 900, 900));
  diagram.addEntity("subjectAreas", makeArea("a1"));
  ui.selectArea("a1");

  scope.setScopedToggle("fields", true);

  assert.deepEqual(scope.overrides, { in: { fields: true } });
  assert.equal(viewState.toggles.fields, true, "the canvas default is untouched");
});

test("a display mode with a selection writes the preset as overrides", () => {
  const { diagram, ui, viewState, scope } = setup();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");

  scope.setScopedDisplayMode("all");

  assert.deepEqual(scope.overrides, { t1: togglesForDisplayMode("all") });
  assert.equal(viewState.displayMode, "attributes");
});

test("a display mode without a selection writes the global view state", () => {
  const { viewState, scope } = setup();

  scope.setScopedDisplayMode("entity");

  assert.equal(viewState.displayMode, "entity");
  assert.deepEqual(scope.overrides, {});
});

// —— The indicator state (ruling Q1: a permanent scope indicator) ——

test("the scope indicator reports the canvas or the number of tables", () => {
  const { diagram, ui, scope } = setup();
  diagram.addTable(makeTable("t1"));
  diagram.addTable(makeTable("t2"));

  assert.equal(scope.scopeKind, "canvas");
  assert.equal(scope.scopeCount, 0);

  ui.selectTable("t1");
  assert.equal(scope.scopeKind, "tables");
  assert.equal(scope.scopeCount, 1);

  ui.selectTable("t2", true);
  assert.equal(scope.scopeCount, 2);

  ui.clearSelection();
  assert.equal(scope.scopeKind, "canvas");
});

test("a selection that resolves to no tables still scopes the write", () => {
  const { diagram, ui, viewState, scope } = setup();
  diagram.addTable(makeTable("out", 900, 900));
  diagram.addEntity("subjectAreas", makeArea("a1"));
  ui.selectArea("a1");

  scope.setScopedToggle("description", true);

  assert.equal(scope.scopeKind, "tables");
  assert.equal(scope.scopeCount, 0);
  assert.deepEqual(scope.overrides, {});
  assert.equal(viewState.toggles.description, false);
});

test("overrideFor returns the override of one table and reset clears them", () => {
  const { diagram, ui, scope } = setup();
  diagram.addTable(makeTable("t1"));
  ui.selectTable("t1");
  scope.setScopedToggle("description", true);

  assert.deepEqual(scope.overrideFor("t1"), { description: true });
  assert.equal(scope.overrideFor("t2"), undefined);

  scope.resetOverrides();
  assert.deepEqual(scope.overrides, {});
});
