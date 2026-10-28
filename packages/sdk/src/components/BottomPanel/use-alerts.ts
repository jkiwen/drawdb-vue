import { computed } from "vue";
import type { PhysicalSpec } from "@drawdb/core";
import type { LocalizedIssue } from "../../composables/use-issues.ts";
import { useIssues } from "../../composables/use-issues.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import type { FocusIssueTarget } from "../../stores/selection-actions.ts";
import { useUIStore } from "../../stores/ui.ts";
import type { DialectDiagnostic, DialectSeverity } from "./dialect-lint.ts";
import { emptyTypeScope, lintDialect } from "./dialect-lint.ts";

/** The channel an alert of the bottom panel comes from. */
export type AlertSource = "diagram" | "dialect";

/**
 * One entry of the alerts tab of the bottom panel.
 *
 * The tab merges the two diagnostic channels of the design (section 8.1):
 * the DiagramIssue list of the core validator and the DialectDiagnostic
 * list of the dialect lint. Both are recomputed from the diagram on every
 * edit and never stored; the alert carries the ids of the object it is
 * about, so a click can select and scroll to it.
 *
 * A dialect diagnostic may carry a suggested physical specification; an
 * alert with `fixable` shows a button that applies it through the command
 * path of the diagram store (ruling 6.5: the fix is an explicit user
 * choice, so the field type source becomes explicit).
 */
export interface AlertItem {
  id: string;
  source: AlertSource;
  severity: "error" | "warning" | "info";
  code: string;
  label: string;
  /** The object the alert is about; null when there is nothing to focus. */
  target: FocusIssueTarget | null;
  /** Whether the alert carries a suggested fix the user can apply. */
  fixable: boolean;
  /** The suggested physical type of a fixable dialect alert. */
  suggestion?: PhysicalSpec;
}

/** The number of alerts the panel keeps; older entries are dropped. */
export const MAX_ALERTS = 1000;

/** The display order of the severities: errors first. */
const SEVERITY_RANK: Record<AlertItem["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** The anchor of an issue, to key the alert and to name the test ids. */
function anchor(issue: LocalizedIssue): string {
  return (
    issue.tableId ??
    issue.relationshipId ??
    issue.viewId ??
    issue.typeId ??
    issue.enumName ??
    issue.code
  );
}

/** Builds the focus target of an issue; null when it carries no object. */
function issueTarget(issue: LocalizedIssue): FocusIssueTarget | null {
  const target: FocusIssueTarget = {
    tableId: issue.tableId,
    fieldId: issue.fieldId,
    relationshipId: issue.relationshipId,
    viewId: issue.viewId,
  };
  return target.tableId || target.relationshipId || target.viewId
    ? target
    : null;
}

/** Builds the focus target of a dialect diagnostic from its scope. */
function dialectTarget(
  diagnostic: DialectDiagnostic,
): FocusIssueTarget | null {
  const scope = diagnostic.scope;
  if (scope.tableId) {
    return {
      tableId: String(scope.tableId),
      fieldId: scope.fieldId ? String(scope.fieldId) : undefined,
    };
  }
  if (scope.relationshipId !== undefined) {
    return { relationshipId: String(scope.relationshipId) };
  }
  return null;
}

/**
 * Deduplicates, caps and orders the merged alerts (plan Task 6 item 6).
 *
 * The incoming list is the newest-first generation order of the two
 * channels; the first entry of a `(code, tableId, fieldId)` group wins, so
 * a repeated diagnostic never piles up. The cap keeps the newest entries
 * and drops the oldest. The display order is errors, warnings, info, and
 * then the code, so the tab always reads the same way.
 */
export function mergeAlerts(items: AlertItem[]): AlertItem[] {
  const seen = new Set<string>();
  const unique: AlertItem[] = [];
  for (const item of items) {
    if (unique.length >= MAX_ALERTS) break;
    const key = `${item.code}|${item.target?.tableId ?? ""}|${item.target?.fieldId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.code.localeCompare(b.code),
  );
}

/**
 * The alerts of the bottom panel, merged from both diagnostic channels.
 *
 * The list is derived from the diagram, so it changes with every edit; the
 * dialect lint runs with the minimal empty type scope (plan Task 6 item 2:
 * compute on the fly, never store).
 */
export function useAlerts(): {
  alerts: import("vue").ComputedRef<AlertItem[]>;
  errorCount: import("vue").ComputedRef<number>;
  warningCount: import("vue").ComputedRef<number>;
  infoCount: import("vue").ComputedRef<number>;
  focus: (alert: AlertItem) => void;
  applyFix: (alert: AlertItem) => void;
} {
  const ui = useUIStore();
  const diagram = useDiagramStore();
  const { issues } = useIssues();

  const dialectDiagnostics = computed<DialectDiagnostic[]>(() => {
    void diagram.revision;
    return lintDialect(diagram.diagram, emptyTypeScope());
  });

  const alerts = computed<AlertItem[]>(() => {
    const items: AlertItem[] = issues.value.map((issue) => ({
      id: `diagram-${issue.code}-${anchor(issue)}`,
      source: "diagram",
      severity: issue.severity,
      code: issue.code,
      label: issue.label,
      target: issueTarget(issue),
      fixable: false,
    }));
    for (const diagnostic of dialectDiagnostics.value) {
      const severity: DialectSeverity = diagnostic.severity;
      items.push({
        id: `dialect-${diagnostic.code}-${JSON.stringify(diagnostic.scope)}`,
        source: "dialect",
        severity,
        code: diagnostic.code,
        label: diagnostic.message,
        target: dialectTarget(diagnostic),
        fixable: diagnostic.fixable,
        suggestion: diagnostic.suggestion,
      });
    }
    return mergeAlerts(items);
  });

  const errorCount = computed(
    () => alerts.value.filter((alert) => alert.severity === "error").length,
  );
  const warningCount = computed(
    () => alerts.value.filter((alert) => alert.severity === "warning").length,
  );
  const infoCount = computed(
    () => alerts.value.filter((alert) => alert.severity === "info").length,
  );

  /** Selects and scrolls to the object the alert is about. */
  function focus(alert: AlertItem): void {
    if (alert.target) {
      ui.focusIssue(alert.target);
    }
  }

  /**
   * Applies the suggested physical type of a fixable alert (ruling 6.5).
   *
   * The writes go through the ordinary `updateField` command of the
   * diagram store, so the fix is undoable and never mutates the diagram in
   * place; it is not applied when the alert carries no suggestion or no
   * field to write to.
   */
  function applyFix(alert: AlertItem): void {
    const target = alert.target;
    if (!alert.fixable || !alert.suggestion || !target?.tableId || !target.fieldId) {
      return;
    }
    diagram.updateField(target.tableId, target.fieldId, {
      fieldType: alert.suggestion,
      fieldTypeSource: "explicit",
    });
  }

  return {
    alerts,
    errorCount,
    warningCount,
    infoCount,
    focus,
    applyFix,
  };
}
