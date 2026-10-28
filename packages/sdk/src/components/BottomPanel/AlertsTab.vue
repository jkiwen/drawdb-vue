<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../../i18n/index.ts";
import { copyAlerts, exportAlerts } from "./alerts-export.ts";
import classes from "./alerts-tab.module.css";
import type { AlertItem } from "./use-alerts.ts";
import { useAlerts } from "./use-alerts.ts";

/**
 * The alerts tab of the bottom panel: the merged list of the two
 * diagnostic channels (design section 8.1). Every entry shows a severity
 * icon, the code and the message; clicking an entry with an object selects
 * and scrolls to it. An entry whose object is gone — or that never carried
 * one, like a domain conflict — is disabled (design section 8.3).
 *
 * The severity filter is pure view state: it never changes the derived
 * alert list, only what the tab shows. A fixable dialect alert offers a
 * "Fix" button that applies its suggested physical type through the command
 * path of the diagram store. The copy and export actions write exactly the
 * alerts the filter left visible.
 */

/** The severity filters of the tab; "all" is the initial one. */
type AlertFilter = "all" | AlertItem["severity"];

const FILTERS: AlertFilter[] = ["all", "error", "warning", "info"];

const { alerts, errorCount, warningCount, infoCount, focus, applyFix } =
  useAlerts();

const filter = ref<AlertFilter>("all");

const counts = computed<Record<AlertFilter, number>>(() => ({
  all: alerts.value.length,
  error: errorCount.value,
  warning: warningCount.value,
  info: infoCount.value,
}));

/** The alerts the tab shows: everything or the chosen severity. */
const visibleAlerts = computed<AlertItem[]>(() =>
  filter.value === "all"
    ? alerts.value
    : alerts.value.filter((alert) => alert.severity === filter.value),
);

/** The glyph of the severity of an alert. */
function severityIcon(severity: AlertItem["severity"]): string {
  return severity === "error" ? "✕" : severity === "warning" ? "⚠" : "ℹ";
}

/** Copies the visible alerts; the helper guards the clipboard API. */
async function onCopy(): Promise<void> {
  await copyAlerts(visibleAlerts.value);
}

/** Downloads the visible alerts as a text file. */
function onExport(): void {
  exportAlerts(visibleAlerts.value);
}
</script>

<template>
  <div :class="classes.tabBody" data-testid="alerts-tab">
    <div :class="classes.toolbar">
      <div
        :class="classes.filters"
        role="group"
        :aria-label="t('bottom_tab_issues')"
      >
        <button
          v-for="level in FILTERS"
          :key="level"
          type="button"
          :class="[classes.filter, filter === level && classes.filterActive]"
          :aria-pressed="filter === level"
          :data-testid="`alerts-filter-${level}`"
          @click="filter = level"
        >
          {{ t(`bottom_alerts_filter_${level}`) }}
          <span
            :class="classes.count"
            :data-testid="`alerts-filter-count-${level}`"
          >{{ counts[level] }}</span>
        </button>
      </div>
      <div :class="classes.actions">
        <button
          type="button"
          :class="classes.action"
          :disabled="visibleAlerts.length === 0"
          data-testid="alerts-copy"
          @click="onCopy"
        >
          {{ t("copy") }}
        </button>
        <button
          type="button"
          :class="classes.action"
          :disabled="visibleAlerts.length === 0"
          data-testid="alerts-export"
          @click="onExport"
        >
          {{ t("export") }}
        </button>
      </div>
    </div>
    <ul
      v-if="visibleAlerts.length > 0"
      :class="classes.alertList"
      data-testid="alerts-list"
    >
      <li
        v-for="(alert, index) in visibleAlerts"
        :key="alert.id"
        :class="classes.alertRow"
      >
        <button
          type="button"
          :class="classes.alertItem"
          data-testid="alert-item"
          :data-severity="alert.severity"
          :data-source="alert.source"
          :disabled="!alert.target"
          :title="alert.target ? undefined : t('alerts_no_target')"
          @click="focus(alert)"
        >
          <span
            :class="[classes.severityIcon, classes[`severity_${alert.severity}`]]"
            aria-hidden="true"
          >{{ severityIcon(alert.severity) }}</span>
          <span :class="classes.alertCode">{{ alert.code }}</span>
          <span :class="classes.alertLabel">{{ alert.label }}</span>
        </button>
        <button
          v-if="alert.fixable"
          type="button"
          :class="classes.fix"
          :data-testid="`alert-fix-${index}`"
          :aria-label="t('bottom_alert_fix')"
          @click="applyFix(alert)"
        >
          {{ t("bottom_alert_fix") }}
        </button>
      </li>
    </ul>
    <p
      v-else-if="filter !== 'all'"
      :class="classes.empty"
      data-testid="alerts-filter-empty"
    >
      {{ t("bottom_alerts_filter_empty") }}
    </p>
    <p v-else :class="classes.empty" data-testid="alerts-empty">
      {{ t("alerts_empty") }}
    </p>
  </div>
</template>
