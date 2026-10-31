import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isHostOwnedMenuKey, runEditorMenu } from "./editor-menu.ts";
import type { EditorMenuActions } from "./editor-menu.ts";

/** Records every action the dispatcher triggers. */
function recorder(): {
  actions: EditorMenuActions;
  calls: string[];
} {
  const calls: string[] = [];
  const record = (name: string) => () => calls.push(name);
  const actions: EditorMenuActions = {
    save: record("save"),
    exportSql: record("exportSql"),
    exportDbml: record("exportDbml"),
    exportJson: record("exportJson"),
    openDialog: (dialog, options) =>
      calls.push(`openDialog:${dialog}:${options?.format ?? "-"}`),
    openImport: (format) => calls.push(`openImport:${format}`),
    addTable: record("addTable"),
    addNote: record("addNote"),
    addArea: record("addArea"),
    autoLayout: record("autoLayout"),
    autoRelationships: record("autoRelationships"),
    addRelationship: record("addRelationship"),
    deleteSelection: record("deleteSelection"),
    toggleFullscreen: record("toggleFullscreen"),
    toggleSidebar: record("toggleSidebar"),
    toggleViewMode: record("toggleViewMode"),
    toggleGrid: record("toggleGrid"),
    zoomIn: record("zoomIn"),
    zoomOut: record("zoomOut"),
    resetView: record("resetView"),
    validate: record("validate"),
  };
  return { actions, calls };
}

describe("the menu of the editor", () => {
  it("saves the diagram", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:save", actions), true);
    assert.deepEqual(calls, ["save"]);
  });

  it("exports the SQL and opens the preview of it", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:export-sql", actions), true);
    assert.deepEqual(calls, ["exportSql", "openDialog:sqlPreview:sql"]);
  });

  it("exports the DBML and opens the preview of it", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:export-dbml", actions), true);
    assert.deepEqual(calls, ["exportDbml", "openDialog:sqlPreview:dbml"]);
  });

  it("exports the JSON of the diagram", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:export-json", actions), true);
    assert.deepEqual(calls, ["exportJson"]);
  });

  it("opens the import wizard with the format of the entry", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:import-sql", actions), true);
    assert.equal(runEditorMenu("file:import-dbml", actions), true);
    assert.equal(runEditorMenu("file:import-json", actions), true);
    assert.equal(runEditorMenu("file:import-erwin", actions), true);
    assert.deepEqual(calls, [
      "openImport:sql",
      "openImport:dbml",
      "openImport:json",
      "openImport:erwin",
    ]);
  });

  it("opens the image export dialog", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:export-png", actions), true);
    assert.deepEqual(calls, ["openDialog:imageExport:-"]);
  });

  it("opens the dialog of the automatic relationships", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("edit:auto-relationships", actions), true);
    assert.deepEqual(calls, ["autoRelationships"]);
  });

  it("adds tables, notes and areas", () => {
    const { actions, calls } = recorder();
    runEditorMenu("edit:add-table", actions);
    runEditorMenu("edit:add-note", actions);
    runEditorMenu("edit:add-area", actions);
    assert.deepEqual(calls, ["addTable", "addNote", "addArea"]);
  });

  it("arranges the tables", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("edit:auto-layout", actions), true);
    assert.deepEqual(calls, ["autoLayout"]);
  });

  it("deletes the selection", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("edit:delete", actions), true);
    assert.deepEqual(calls, ["deleteSelection"]);
  });

  it("switches the view of the canvas", () => {
    const { actions, calls } = recorder();
    runEditorMenu("view:toggle-sidebar", actions);
    runEditorMenu("view:toggle-view-mode", actions);
    runEditorMenu("view:toggle-grid", actions);
    assert.deepEqual(calls, [
      "toggleSidebar",
      "toggleViewMode",
      "toggleGrid",
    ]);
  });

  it("zooms the canvas in and out", () => {
    const { actions, calls } = recorder();
    runEditorMenu("view:zoom-in", actions);
    runEditorMenu("view:zoom-out", actions);
    assert.deepEqual(calls, ["zoomIn", "zoomOut"]);
  });

  it("resets the view of the canvas", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("view:reset-view", actions), true);
    assert.deepEqual(calls, ["resetView"]);
  });

  it("keeps answering the older keys of the menu", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("view:reset-zoom", actions), true);
    assert.equal(runEditorMenu("file:auto-relationships", actions), true);
    assert.deepEqual(calls, [
      "resetView",
      "autoRelationships",
    ]);
  });

  it("validates the diagram", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("view:validate", actions), true);
    assert.deepEqual(calls, ["validate"]);
  });

  it("leaves the entries of the host application to it", () => {
    const { actions, calls } = recorder();
    for (const key of [
      "file:new",
      "file:open",
      "help:documentation",
      "help:about",
    ]) {
      assert.equal(runEditorMenu(key, actions), false, key);
      assert.equal(isHostOwnedMenuKey(key), true, key);
    }
    assert.deepEqual(calls, []);
  });

  it("opens the relationship editor on its own", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("edit:add-relationship", actions), true);
    assert.equal(isHostOwnedMenuKey("edit:add-relationship"), false);
    assert.deepEqual(calls, ["addRelationship"]);
  });

  it("leaves an unknown entry to the host application", () => {
    const { actions, calls } = recorder();
    assert.equal(runEditorMenu("file:unknown", actions), false);
    assert.equal(isHostOwnedMenuKey("file:unknown"), false);
    assert.deepEqual(calls, []);
  });
});
