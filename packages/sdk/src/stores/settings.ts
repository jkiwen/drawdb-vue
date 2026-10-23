import type { DatabaseType } from "@drawdb/core";
import { defineStore } from "pinia";
import { reactive } from "vue";

export type ThemeMode = "light" | "dark" | "auto";

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
