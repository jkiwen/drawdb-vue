<script setup lang="ts">
import { computed, reactive } from "vue";
import { NSelect, NSwitch } from "naive-ui";
import { useSettingsStore, type ThemeMode } from "@drawdb/vue-sdk";
import { t } from "@drawdb/vue-sdk";

/**
 * The application-wide preferences (ruling Q7).
 *
 * Everything here is application level: the same choices apply to every
 * diagram, and the settings store persists them. A change is written as it is
 * made, so the dialog has no Save button to forget.
 */
const settings = useSettingsStore();

const themeOptions = computed(() => [
  { label: t("light"), value: "light" },
  { label: t("dark"), value: "dark" },
  { label: t("pref_auto"), value: "auto" },
]);

const databaseOptions = computed(() => [
  { label: "MySQL", value: "mysql" },
  { label: "PostgreSQL", value: "postgres" },
  { label: "SQLite", value: "sqlite" },
  { label: "MariaDB", value: "mariadb" },
  { label: "SQL Server", value: "mssql" },
  { label: "Oracle SQL", value: "oraclesql" },
  { label: "Generic", value: "generic" },
]);

const draft = reactive({
  theme: settings.settings.theme,
  defaultDatabase: settings.settings.defaultDatabase,
  autoSave: settings.settings.autoSave,
  autoSaveIntervalMs: settings.settings.autoSaveIntervalMs,
});

function setTheme(value: ThemeMode): void {
  draft.theme = value;
  settings.update({ theme: value });
}

function setDatabase(value: string): void {
  draft.defaultDatabase = value as typeof draft.defaultDatabase;
  settings.update({ defaultDatabase: draft.defaultDatabase });
}

function setAutoSave(value: boolean): void {
  draft.autoSave = value;
  settings.update({ autoSave: value });
}

function setIntervalMs(value: number): void {
  const next = Number.isFinite(value) && value > 0 ? value : 5000;
  draft.autoSaveIntervalMs = next;
  settings.update({ autoSaveIntervalMs: next });
}
</script>

<template>
  <div class="preferences" data-testid="preferences">
    <h2 class="preferences__title">{{ t("settings") }}</h2>

    <label class="preferences__row">
      <span>{{ t("pref_theme") }}</span>
      <NSelect
        :value="draft.theme"
        :options="themeOptions"
        data-testid="pref-theme"
        @update:value="(value: ThemeMode) => setTheme(value)"
      />
    </label>

    <label class="preferences__row">
      <span>{{ t("pref_default_database") }}</span>
      <NSelect
        :value="draft.defaultDatabase"
        :options="databaseOptions"
        data-testid="pref-database"
        @update:value="setDatabase"
      />
    </label>

    <label class="preferences__row">
      <span>{{ t("autosave") }}</span>
      <NSwitch
        :value="draft.autoSave"
        data-testid="pref-auto-save"
        @update:value="setAutoSave"
      />
    </label>

    <label class="preferences__row">
      <span>{{ t("pref_auto_save_interval") }}</span>
      <input
        class="preferences__number"
        type="number"
        min="500"
        step="500"
        :value="draft.autoSaveIntervalMs"
        data-testid="pref-auto-save-interval"
        @change="setIntervalMs(Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>

<style scoped>
.preferences {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
}

.preferences__title {
  margin: 0;
  font-size: 15px;
}

.preferences__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: var(--text);
}

.preferences__number {
  width: 96px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
</style>
