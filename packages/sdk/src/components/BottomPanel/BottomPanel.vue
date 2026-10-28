<script setup lang="ts">
import { computed, watch } from "vue";
import { t } from "../../i18n/index.ts";
import { useUIStore } from "../../stores/ui.ts";
import AlertsTab from "./AlertsTab.vue";
import classes from "./BottomPanel.module.css";
import HistoryTab from "./HistoryTab.vue";
import PlaceholderTab from "./PlaceholderTab.vue";
import { useAlerts } from "./use-alerts.ts";
import type { BottomPanelTab } from "./use-bottom-panel.ts";
import { useBottomPanel } from "./use-bottom-panel.ts";

/**
 * The resizable bottom panel of the editor (design section 8): the alerts
 * tab merges the diagram and the dialect diagnostic channels, the log and
 * trace tabs are placeholders and the history tab mirrors the undo stack.
 *
 * Collapsed, the panel is a 28px title bar; a drag of its top edge adjusts
 * the height (120–400px, persisted) and a double click restores the
 * default. New errors never auto expand the panel (ruling Q9): the title
 * bar shows the error badge and a one-time toast is raised instead. The
 * trace tab is only visible in the developer mode (ruling Q14).
 */
defineOptions({ name: "DrawDBBottomPanel" });

const props = defineProps({
  /** Whether the host runs the editor in the developer mode (Q14). */
  devMode: { type: Boolean, default: false },
});

const ui = useUIStore();
const panel = useBottomPanel();
const { errorCount } = useAlerts();

/** The tabs the header shows; the trace tab is developer-only (Q14). */
const tabs = computed<{ id: BottomPanelTab; label: string }[]>(() => {
  const items: { id: BottomPanelTab; label: string }[] = [
    { id: "issues", label: t("bottom_tab_issues") },
    { id: "log", label: t("bottom_tab_log") },
    { id: "history", label: t("bottom_tab_history") },
  ];
  if (props.devMode) {
    items.push({ id: "trace", label: t("bottom_tab_trace") });
  }
  return items;
});

/** The inline height of the panel; the collapsed panel is its title bar. */
const panelStyle = computed(() => ({
  height: `${panel.collapsed.value ? 28 : panel.height.value}px`,
}));

// Ruling Q9: the arrival of errors raises a single toast instead of
// auto-expanding the panel. A later edit that keeps errors around does not
// raise another one.
watch(errorCount, (next, previous) => {
  if (next > 0 && (previous === undefined || previous === 0)) {
    ui.notify(t("bottom_error_count", { count: next }));
  }
});

// An explicit validation (the host calls openIssuesTab, which sets the ui
// activeTab to "issues") is user intent, not an error arriving: the panel
// expands on the issues tab. This is the validate flow the side panel used
// to serve.
watch(
  () => ui.activeTab,
  (tab) => {
    if (tab === "issues") {
      panel.setTab("issues");
      panel.setCollapsed(false);
    }
  },
);
</script>

<template>
  <section
    :class="[classes.panel, panel.collapsed.value && classes.collapsed]"
    :style="panelStyle"
    data-testid="bottom-panel"
  >
    <div
      v-if="!panel.collapsed.value"
      :class="classes.resizer"
      role="separator"
      aria-orientation="horizontal"
      data-testid="bottom-panel-resizer"
      @mousedown="panel.startResize"
      @dblclick="panel.resetHeight"
    />
    <header :class="classes.header" data-testid="bottom-panel-header">
      <div :class="classes.tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :class="[classes.tab, panel.activeTab.value === tab.id && classes.tabActive]"
          :aria-selected="panel.activeTab.value === tab.id"
          :data-testid="`tab-${tab.id}`"
          @click="panel.setTab(tab.id)"
        >
          {{ tab.label }}
          <span
            v-if="tab.id === 'issues' && errorCount > 0"
            :class="classes.errorBadge"
            data-testid="issues-error-badge"
          >{{ errorCount }}</span>
        </button>
      </div>
      <button
        type="button"
        :class="classes.toggle"
        :aria-label="t(panel.collapsed.value ? 'bottom_expand' : 'bottom_collapse')"
        :aria-expanded="!panel.collapsed.value"
        data-testid="bottom-panel-toggle"
        @click="panel.toggleCollapsed"
      >
        <svg
          :class="[classes.chevron, panel.collapsed.value && classes.chevronFlipped]"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
        >
          <path
            d="M3.5 10.5 8 6l4.5 4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>
    <div
      v-if="!panel.collapsed.value"
      :class="classes.body"
      data-testid="bottom-panel-body"
    >
      <AlertsTab v-if="panel.activeTab.value === 'issues'" />
      <PlaceholderTab
        v-else-if="panel.activeTab.value === 'log'"
        testid="log"
        :message="t('bottom_log_empty')"
      />
      <HistoryTab v-else-if="panel.activeTab.value === 'history'" />
      <PlaceholderTab
        v-else
        testid="trace"
        :message="t('bottom_trace_empty')"
      />
    </div>
    <div
      v-if="ui.lastNotification"
      :class="classes.toast"
      role="status"
      data-testid="bottom-panel-toast"
    >
      <span>{{ ui.lastNotification.text }}</span>
      <button
        type="button"
        :class="classes.toastDismiss"
        data-testid="toast-dismiss"
        @click="ui.clearNotification"
      >
        ✕
      </button>
    </div>
  </section>
</template>
