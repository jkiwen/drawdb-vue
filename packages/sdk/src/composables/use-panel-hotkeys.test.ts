/**
 * Tests for the panel hotkeys (plan Task 1 item 3): mod+b toggles the left
 * panel, mod+alt+b the right one, mod+` the bottom one. The bindings feed the
 * shared hotkey registry through a window keydown listener.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../stores/settings.ts";
import { usePanelHotkeys } from "./use-panel-hotkeys.ts";

function keydown(
  key: string,
  init: { ctrlKey?: boolean; altKey?: boolean } = {},
): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, ctrlKey: true, ...init }),
  );
}

describe("use-panel-hotkeys", () => {
  // The settings store restores persisted preferences, and the runner shares
  // one process (and one localStorage) between the specs.
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles the left panel with mod+b", () => {
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    assert.equal(settings.settings.panelLeftCollapsed, false);
    const stop = usePanelHotkeys();
    keydown("b");
    assert.equal(settings.settings.panelLeftCollapsed, true);
    keydown("b");
    assert.equal(settings.settings.panelLeftCollapsed, false);
    stop();
  });

  it("toggles the right panel with mod+alt+b", () => {
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    const stop = usePanelHotkeys();
    keydown("b", { altKey: true });
    assert.equal(settings.settings.panelRightCollapsed, true);
    stop();
  });

  it("toggles the bottom panel with mod+`", () => {
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    const stop = usePanelHotkeys();
    keydown("`");
    assert.equal(settings.settings.panelBottomCollapsed, true);
    stop();
  });

  it("stops answering after the stop handle is called", () => {
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    const stop = usePanelHotkeys();
    stop();
    keydown("b");
    assert.equal(settings.settings.panelLeftCollapsed, false);
  });
});
