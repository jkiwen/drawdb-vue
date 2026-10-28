<script setup lang="ts">
import type { AlertItem } from "./use-alerts.ts";
import { t } from "../../i18n/index.ts";
import { useAlerts } from "./use-alerts.ts";
import classes from "./BottomPanel.module.css";

/**
 * The alerts tab of the bottom panel: the merged list of the two
 * diagnostic channels (design section 8.1). Every entry shows a severity
 * icon, the code and the message; clicking an entry with an object selects
 * and scrolls to it. An entry whose object is gone — or that never carried
 * one, like a domain conflict — is disabled (design section 8.3).
 */

const { alerts, focus } = useAlerts();

/** The glyph of the severity of an alert. */
function severityIcon(severity: AlertItem["severity"]): string {
  return severity === "error" ? "✕" : severity === "warning" ? "⚠" : "ℹ";
}
</script>

<template>
  <div :class="classes.tabBody" data-testid="alerts-tab">
    <ul v-if="alerts.length > 0" :class="classes.alertList" data-testid="alerts-list">
      <li v-for="alert in alerts" :key="alert.id">
        <button
          type="button"
          :class="classes.alertItem"
          :data-testid="'alert-item'"
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
      </li>
    </ul>
    <p v-else :class="classes.empty" data-testid="alerts-empty">{{ t("alerts_empty") }}</p>
  </div>
</template>
