import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIDGE_PROPERTY,
  createEditorBridge,
  installEditorBridge,
  removeEditorBridge,
  type BridgeEditor,
} from "./editor-bridge.ts";

/** A stand in for the editor of the SDK. */
function fakeEditor(): BridgeEditor {
  return {
    autoArrange: () => undefined,
    validate: () => [{ code: "x" }],
    openIssuesTab: () => undefined,
    exportSql: () => "SELECT 1;",
    exportDbml: () => "Table users {}",
    importSql: () => ({ imported: true }),
    jumpHistory: (depth: number) => depth === 1,
    runCommand: (key: string) => key === "demo.add-note",
    getDiagram: () => ({ notes: [] }),
  };
}

test("the bridge calls the editor it is bound to", () => {
  const bridge = createEditorBridge(() => fakeEditor());

  assert.equal(bridge.exportSql(), "SELECT 1;");
  assert.equal(bridge.exportDbml(), "Table users {}");
  assert.deepEqual(bridge.importSql("SELECT 1;"), { imported: true });
  assert.equal(bridge.jumpHistory(1), true);
  assert.equal(bridge.jumpHistory(2), false);
  assert.equal(bridge.runCommand("demo.add-note"), true);
  assert.equal(bridge.runCommand("other"), false);
  assert.deepEqual(bridge.getDiagram(), { notes: [] });
  assert.equal(bridge.validate().length, 1);
  assert.equal(typeof bridge.autoArrange, "function");
});

test("the bridge reports no editor before the editor is mounted", () => {
  const bridge = createEditorBridge(() => undefined);

  assert.equal(bridge.editor, undefined);
  assert.equal(bridge.exportSql(), "");
  assert.equal(bridge.exportDbml(), "");
  assert.equal(bridge.jumpHistory(1), false);
  assert.equal(bridge.runCommand("demo.add-note"), false);
  assert.equal(bridge.getDiagram(), undefined);
  assert.deepEqual(bridge.validate(), []);
});

test("the bridge reaches the editor that is mounted at that moment", () => {
  let current: BridgeEditor | undefined;
  const bridge = createEditorBridge(() => current);

  current = fakeEditor();
  assert.equal(bridge.editor, current);
  assert.equal(bridge.exportSql(), "SELECT 1;");
});

test("the bridge is published on the window and removed again", () => {
  const bridge = createEditorBridge(() => fakeEditor());

  installEditorBridge(bridge);
  const published = (globalThis as unknown as Record<string, unknown>)[
    BRIDGE_PROPERTY
  ];
  assert.equal(published, bridge);

  removeEditorBridge();
  assert.equal(
    (globalThis as unknown as Record<string, unknown>)[BRIDGE_PROPERTY],
    undefined,
  );
});
