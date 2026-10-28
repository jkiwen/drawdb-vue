import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  readPersistedSettings,
  useSettingsStore,
} from "./settings.ts";

describe("settings store panel preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("defaults the panel sizes and states", () => {
    assert.equal(DEFAULT_SETTINGS.panelLeftWidth, 280);
    assert.equal(DEFAULT_SETTINGS.panelRightWidth, 464);
    assert.equal(DEFAULT_SETTINGS.panelLeftCollapsed, false);
    assert.equal(DEFAULT_SETTINGS.panelRightCollapsed, false);
  });

  it("persists a panel preference into the local storage", () => {
    const store = useSettingsStore();
    store.update({ panelLeftWidth: 300, panelRightCollapsed: true });
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    assert.equal(stored.panelLeftWidth, 300);
    assert.equal(stored.panelRightCollapsed, true);
  });

  it("reads a persisted panel preference on startup", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ panelLeftWidth: 250, panelLeftCollapsed: true }),
    );
    const store = useSettingsStore();
    assert.equal(store.settings.panelLeftWidth, 250);
    assert.equal(store.settings.panelLeftCollapsed, true);
    assert.equal(store.settings.panelRightWidth, 464);
  });

  it("reports only the persisted keys, without the defaults", () => {
    assert.deepEqual(readPersistedSettings(), {});
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ panelRightWidth: 360 }),
    );
    assert.deepEqual(readPersistedSettings(), { panelRightWidth: 360 });
  });
});
