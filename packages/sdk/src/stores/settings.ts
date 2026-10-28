import type { DatabaseType } from "@drawdb/core";
import { defineStore } from "pinia";
import { reactive } from "vue";

export type ThemeMode = "light" | "dark" | "auto";

/** The bounds and the defaults of the widths of the layout panels. */
export const PANEL_LEFT_MIN_WIDTH = 240;
export const PANEL_LEFT_MAX_WIDTH = 320;
export const PANEL_LEFT_DEFAULT_WIDTH = 280;
export const PANEL_RIGHT_MIN_WIDTH = 320;
export const PANEL_RIGHT_MAX_WIDTH = 560;
export const PANEL_RIGHT_DEFAULT_WIDTH = 464;

/** The bounds and the default of the height of the bottom panel. */
export const PANEL_BOTTOM_MIN_HEIGHT = 120;
export const PANEL_BOTTOM_MAX_HEIGHT = 400;
export const PANEL_BOTTOM_DEFAULT_HEIGHT = 168;

export interface DrawDBSettings {
  theme: ThemeMode;
  language: string;
  fontSize: number;
  defaultDatabase: DatabaseType;
  autoSave: boolean;
  autoSaveIntervalMs: number;
  showMinimap: boolean;
  snapToGrid: boolean;
  showFieldTypes: boolean;
  /**
   * The width of the left panel of the layout, in pixels.
   *
   * The panel preferences are optional so that the state a user persisted
   * before they existed stays valid. The defaults below fill the gaps.
   */
  panelLeftWidth?: number;
  /** The width of the right panel of the layout, in pixels. */
  panelRightWidth?: number;
  /** Whether the left panel of the layout is collapsed. */
  panelLeftCollapsed?: boolean;
  /** Whether the right panel of the layout is collapsed. */
  panelRightCollapsed?: boolean;
  /** Whether the bottom panel of the layout is collapsed. */
  panelBottomCollapsed?: boolean;
  /** The height of the expanded bottom panel of the layout, in pixels. */
  panelBottomHeight?: number;
}

export const SETTINGS_STORAGE_KEY = "drawdb:settings";

export const DEFAULT_SETTINGS: DrawDBSettings = {
  theme: "light",
  language: "en",
  fontSize: 14,
  defaultDatabase: "generic",
  autoSave: true,
  autoSaveIntervalMs: 5000,
  showMinimap: false,
  snapToGrid: true,
  showFieldTypes: true,
  panelLeftWidth: PANEL_LEFT_DEFAULT_WIDTH,
  panelRightWidth: PANEL_RIGHT_DEFAULT_WIDTH,
  panelLeftCollapsed: false,
  panelRightCollapsed: false,
  panelBottomCollapsed: false,
  panelBottomHeight: PANEL_BOTTOM_DEFAULT_HEIGHT,
};

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function readSettings(): Partial<DrawDBSettings> {
  const store = storage();
  if (!store) return {};

  try {
    const raw = store.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<DrawDBSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The settings the user persisted, without the defaults.
 *
 * The layout reads them to tell an explicit preference of the user apart
 * from a gap the defaults filled.
 */
export function readPersistedSettings(): Partial<DrawDBSettings> {
  return readSettings();
}

/**
 * User preferences of the editor. The state is mirrored into `localStorage`
 * when the browser provides one and silently degrades to in-memory state
 * otherwise.
 */
export const useSettingsStore = defineStore("settings", () => {
  const settings = reactive<DrawDBSettings>({
    ...DEFAULT_SETTINGS,
    ...readSettings(),
  });

  function persist(): void {
    const store = storage();
    if (!store) return;

    try {
      store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable (private mode, quota); settings stay in memory.
    }
  }

  function update(partial: Partial<DrawDBSettings>): void {
    Object.assign(settings, partial);
    persist();
  }

  function reset(): void {
    Object.assign(settings, DEFAULT_SETTINGS);
    persist();
  }

  return { settings, update, reset, persist };
});

export type SettingsStore = ReturnType<typeof useSettingsStore>;
