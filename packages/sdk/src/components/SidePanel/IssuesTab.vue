<script setup lang="ts">
import { computed } from "vue";
import type { LocalizedIssue } from "../../composables/use-issues.ts";
import { useIssues } from "../../composables/use-issues.ts";
import { useUIStore } from "../../stores/ui.ts";

/** The issues tab of the side panel. */

const ui = useUIStore();
const { issues } = useIssues();

const errors = computed(() =>
  issues.value.filter((issue) => issue.severity === "error"),
);
const warnings = computed(() =>
  issues.value.filter((issue) => issue.severity === "warning"),
);

/** Selects and scrolls to the object the issue is about. */
function focus(issue: LocalizedIssue): void {
  ui.focusIssue(issue);
}

/** The anchor of an issue, to key the list and to name the test ids. */
function anchor(issue: LocalizedIssue): string {
  return (
    issue.tableId ??
    issue.relationshipId ??
    issue.viewId ??
    issue.typeId ??
    issue.enumName ??
    issue.code.replace(/[^a-z0-9]+/gi, "-")
  );
}
</script>

<template>
  <div class="issues-tab" data-testid="issues-tab">
    <section v-if="errors.length > 0" class="issues-group" data-testid="issues-errors">
      <h4 class="issues-group__title">Errors</h4>
      <ul class="issues-list" data-testid="issues-list">
        <li v-for="issue in errors" :key="`${issue.code}-${anchor(issue)}`">
          <button
            class="issue-item"
            :data-testid="`issue-item`"
            type="button"
            @click="focus(issue)"
          >
            {{ issue.label }}
          </button>
        </li>
      </ul>
    </section>

    <section v-if="warnings.length > 0" class="issues-group" data-testid="issues-warnings">
      <h4 class="issues-group__title">Warnings</h4>
      <ul class="issues-list" data-testid="issues-list">
        <li v-for="issue in warnings" :key="`${issue.code}-${anchor(issue)}`">
          <button
            class="issue-item"
            :data-testid="`issue-item`"
            type="button"
            @click="focus(issue)"
          >
            {{ issue.label }}
          </button>
        </li>
      </ul>
    </section>

    <p v-if="issues.length === 0" class="issues-empty" data-testid="issues-empty">
      No issues found.
    </p>
  </div>
</template>

<style scoped>
.issues-tab {
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-3);
}

/* The severity is carried by the title of the group, so the reader knows what
   the list below is about before reading it. */
.issues-group__title {
  margin: 0 0 var(--ddb-space-1);
  font-size: var(--ddb-text-meta);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ddb-text-muted);
}

.issues-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-1);
}

.issue-item {
  width: 100%;
  padding: var(--ddb-space-1) var(--ddb-space-2);
  border: 0;
  border-radius: var(--ddb-radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--ddb-text-body);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ddb-duration-fast) var(--ddb-easing);
}

.issue-item:hover {
  background: var(--ddb-surface-hover);
}

.issues-empty {
  margin: 0;
  color: var(--ddb-text-muted);
  font-size: var(--ddb-text-meta);
}
</style>
