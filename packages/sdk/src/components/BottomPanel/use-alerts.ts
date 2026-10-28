import { computed } from "vue";
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
 */
export interface AlertItem {
  id: string;
  source: AlertSource;
  severity: "error" | "warning" | "info";
  code: string;
  label: string;
  /** The object the alert is about; null when there is nothing to focus. */
  target: FocusIssueTarget | null;
}

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
  focus: (alert: AlertItem) => void;
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
      });
    }
    return items.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        a.code.localeCompare(b.code),
    );
  });

  const errorCount = computed(
    () => alerts.value.filter((alert) => alert.severity === "error").length,
  );
  const warningCount = computed(
    () => alerts.value.filter((alert) => alert.severity === "warning").length,
  );

  /** Selects and scrolls to the object the alert is about. */
  function focus(alert: AlertItem): void {
    if (alert.target) {
      ui.focusIssue(alert.target);
    }
  }

  return { alerts, errorCount, warningCount, focus };
}
