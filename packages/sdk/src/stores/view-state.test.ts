/**
 * Tests for the view-state store (plan Task 1, UI document section 9.2 and
 * ruling Q2): the view layer, display mode and per-item toggles live in the
 * diagram document (saved with it) but never enter the undo stack.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import {
  createEmptyDiagram,
  createTable,
  displayModeForToggles,
  togglesForDisplayMode,
  type DisplayMode,
  type ViewLayer,
} from "@drawdb/core";
import { useDiagramStore } from "../stores/diagram.ts";
import { useHistoryStore } from "../stores/history.ts";
import { useViewStateStore } from "../stores/view-state.ts";

function freshStores() {
  setActivePinia(createPinia());
  return {
    diagram: useDiagramStore(),
    history: useHistoryStore(),
    viewState: useViewStateStore(),
  };
}

describe("view-state store", () => {
  it("reads the defaults of a fresh diagram", () => {
    const { viewState } = freshStores();
    assert.equal(viewState.viewLayer, "physical");
    assert.equal(viewState.displayMode, "attributes");
    assert.deepEqual(viewState.toggles, togglesForDisplayMode("attributes"));
  });

  it("writes the view layer into the diagram document", () => {
    const { diagram, viewState } = freshStores();
    viewState.setViewLayer("logical" satisfies ViewLayer);
    assert.equal(diagram.diagram.viewState?.viewLayer, "logical");
    assert.equal(viewState.viewLayer, "logical");
  });

  it("applies a display mode as a toggle preset (Q20)", () => {
    const { viewState } = freshStores();
    viewState.setDisplayMode("all" satisfies DisplayMode);
    assert.equal(viewState.displayMode, "all");
    assert.deepEqual(viewState.toggles, togglesForDisplayMode("all"));
  });

  it("derives the custom mode from a manual toggle change", () => {
    const { viewState } = freshStores();
    viewState.setToggle("pkUkFk", true);
    assert.equal(viewState.displayMode, "custom");
    assert.equal(
      viewState.displayMode,
      displayModeForToggles(viewState.toggles),
    );
  });

  it("a manual toggle that matches a preset re-enters that mode", () => {
    const { viewState } = freshStores();
    viewState.setToggle("pkUkFk", true);
    viewState.setToggle("pkUkFk", false);
    viewState.setToggle("description", false);
    viewState.setToggle("indexes", false);
    assert.equal(viewState.displayMode, "attributes");
  });

  it("never touches the undo stack", () => {
    const { history, viewState } = freshStores();
    assert.equal(history.canUndo, false);
    viewState.setViewLayer("logical");
    viewState.setDisplayMode("entity");
    assert.equal(history.canUndo, false);
  });

  it("survives a diagram reload through the document", () => {
    const { diagram, viewState } = freshStores();
    viewState.setViewLayer("logical");
    viewState.setDisplayMode("all");
    const saved = JSON.parse(JSON.stringify(diagram.diagram));
    const reloaded = createEmptyDiagram();
    Object.assign(reloaded, saved);
    reloaded.tables = [createTable({ name: "orders" })];
    diagram.setDiagram(reloaded);
    assert.equal(viewState.viewLayer, "logical");
    assert.equal(viewState.displayMode, "all");
  });
});
