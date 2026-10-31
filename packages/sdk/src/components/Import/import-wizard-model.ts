import type { ImportFormat, ImportIssue, ImportPlan } from "@drawdb/core";

/** The five steps of the wizard (design section 3, "五步向导"). */
export const IMPORT_STEPS = ["source", "report", "target", "conflict", "apply"] as const;

export type ImportStep = (typeof IMPORT_STEPS)[number];

/** What the first step offers, in the order a person is likely to need it. */
export const IMPORT_FORMATS: readonly { format: ImportFormat; labelKey: string }[] = [
  { format: "sql", labelKey: "wizard_format_sql" },
  { format: "dbml", labelKey: "wizard_format_dbml" },
  { format: "json", labelKey: "wizard_format_json" },
  { format: "erwin", labelKey: "wizard_format_erwin" },
];

export function stepIndex(step: ImportStep): number {
  return IMPORT_STEPS.indexOf(step);
}

export function nextStep(step: ImportStep): ImportStep {
  const index = stepIndex(step);
  return IMPORT_STEPS[Math.min(index + 1, IMPORT_STEPS.length - 1)] ?? "apply";
}

export function previousStep(step: ImportStep): ImportStep {
  const index = stepIndex(step);
  return IMPORT_STEPS[Math.max(index - 1, 0)] ?? "source";
}

/** The formats whose file name tells the format. */
export function formatOfFileName(name: string): ImportFormat | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".dbml")) return "dbml";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xml")) return "erwin";
  return undefined;
}

/** The counts the report step shows, in reading order. */
export function countRows(plan: ImportPlan): { key: string; value: number }[] {
  return [
    { key: "tables", value: plan.adds.tables },
    { key: "fields", value: plan.adds.fields },
    { key: "keys", value: plan.adds.keys },
    { key: "relationships", value: plan.adds.relationships },
    { key: "domains", value: plan.adds.domains },
    { key: "notes", value: plan.adds.notes },
    { key: "areas", value: plan.adds.areas },
    { key: "skipped", value: plan.adds.skipped ?? 0 },
  ];
}

/** The issues of one level, in the order the readers reported them. */
export function issuesOfLevel(issues: readonly ImportIssue[], level: ImportIssue["level"]): ImportIssue[] {
  return issues.filter((issue) => issue.level === level);
}

export function levelCounts(issues: readonly ImportIssue[]): Record<ImportIssue["level"], number> {
  return {
    error: issuesOfLevel(issues, "error").length,
    warning: issuesOfLevel(issues, "warning").length,
    info: issuesOfLevel(issues, "info").length,
  };
}

/**
 * Why the wizard cannot move on from the plan, in the words of the person
 * reading it. Empty when the plan is ready.
 */
export interface BlockedReason {
  /** The message key of the reason. */
  key: string;
  /** The number the message counts, when it counts one. */
  count?: number;
}

/** Why the plan is not ready yet, as messages for the person reading it. */
export function blockedReasons(
  plan: ImportPlan | null,
  decided: readonly string[] = [],
  undecidedDomains = 0,
): BlockedReason[] {
  if (plan === null) return [{ key: "wizard_reason_not_read" }];
  if (plan.status === "ready") return [];
  const reasons: BlockedReason[] = [];
  if (plan.blocking.length > 0) {
    reasons.push({ key: "wizard_reason_blocking", count: plan.blocking.length });
  }
  const undecided = plan.conflicts.filter((conflict) => !decided.includes(conflict.id));
  if (undecided.length > 0) reasons.push({ key: "wizard_reason_conflicts", count: undecided.length });
  if (undecidedDomains > 0) {
    reasons.push({ key: "wizard_reason_domains", count: undecidedDomains });
  }
  if (reasons.length === 0) reasons.push({ key: "wizard_reason_choose" });
  return reasons;
}
