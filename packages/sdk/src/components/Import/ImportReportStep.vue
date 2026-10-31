<script setup lang="ts">
import { computed, ref } from "vue";
import type { ImportIssue } from "@drawdb/core";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { countRows, issuesOfLevel, levelCounts } from "./import-wizard-model.ts";
import styles from "./import.module.css";

// TODO(i18n): English until P8 task 8.
const wizard = useImportWizardStore();
const level = ref<ImportIssue["level"] | "all">("all");

const rows = computed(() => (wizard.plan === null ? [] : countRows(wizard.plan)));
const issues = computed(() => wizard.plan?.issues ?? []);
const counts = computed(() => levelCounts(issues.value));
const shown = computed(() =>
  level.value === "all" ? issues.value : issuesOfLevel(issues.value, level.value),
);
const blocked = computed(() => wizard.plan?.blocking.length ?? 0);
</script>

<template>
  <section :class="styles.step" data-testid="import-step-report">
    <dl v-if="wizard.plan" :class="styles.counts" data-testid="import-counts">
      <div v-for="row in rows" :key="row.key">
        <dt>{{ row.label }}</dt>
        <dd :data-testid="`import-count-${row.key}`">{{ row.value }}</dd>
      </div>
    </dl>
    <div :class="styles.filters" role="tablist">
      <button
        v-for="entry in ['all', 'error', 'warning', 'info'] as const"
        :key="entry"
        type="button"
        role="tab"
        :aria-selected="level === entry"
        :class="[styles.filter, level === entry ? styles.filterOn : '']"
        :data-testid="`import-filter-${entry}`"
        @click="level = entry"
      >
        {{ entry }}
        <span :data-testid="`import-filter-count-${entry}`">{{
          entry === "all" ? issues.length : counts[entry]
        }}</span>
      </button>
    </div>
    <ul :class="styles.issues" data-testid="import-issues">
      <li
        v-for="(issue, index) in shown"
        :key="`${issue.code}-${index}`"
        :class="styles.issue"
        :data-level="issue.level"
        data-testid="import-issue"
      >
        <span :class="styles.badge">{{ issue.level }}</span>
        <span :class="styles.code">{{ issue.code }}</span>
        <span :class="styles.path">{{ issue.path }}</span>
        <span :class="styles.message">{{ issue.message }}</span>
      </li>
    </ul>
    <p v-if="shown.length === 0" :class="styles.hint" data-testid="import-issues-empty">
      Nothing to report at this level.
    </p>
    <label v-if="blocked > 0" :class="styles.check">
      <input
        type="checkbox"
        data-testid="import-repair"
        :checked="wizard.repair"
        @change="wizard.setRepair(($event.target as HTMLInputElement).checked)"
      />
      <span>Fix what can be fixed and import the rest</span>
    </label>
  </section>
</template>
