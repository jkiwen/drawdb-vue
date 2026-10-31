import type { ImportFormat, ImportIssue, ImportPlan } from "@drawdb/core";

/** The five steps of the wizard (design section 3, "五步向导"). */
export const IMPORT_STEPS = ["source", "report", "target", "conflict", "apply"] as const;

export type ImportStep = (typeof IMPORT_STEPS)[number];

/** What the first step offers, in the order a person is likely to need it. */
export const IMPORT_FORMATS: readonly { format: ImportFormat; label: string }[] = [
  { format: "sql", label: "SQL" },
  { format: "dbml", label: "DBML" },
  { format: "json", label: "JSON diagram" },
  { format: "erwin", label: "erwin XML" },
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
export function countRows(plan: ImportPlan): { key: string; label: string; value: number }[] {
  return [
    { key: "tables", label: "Tables", value: plan.adds.tables },
    { key: "fields", label: "Columns", value: plan.adds.fields },
    { key: "keys", label: "Keys", value: plan.adds.keys },
    { key: "relationships", label: "Relationships", value: plan.adds.relationships },
    { key: "domains", label: "Logical types", value: plan.adds.domains },
    { key: "notes", label: "Notes", value: plan.adds.notes },
    { key: "areas", label: "Areas", value: plan.adds.areas },
    { key: "skipped", label: "Skipped", value: plan.adds.skipped ?? 0 },
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
export function blockedReasons(
  plan: ImportPlan | null,
  decided: readonly string[] = [],
  undecidedDomains = 0,
): string[] {
  if (plan === null) return ["The file has not been read yet."];
  if (plan.status === "ready") return [];
  const reasons: string[] = [];
  if (plan.blocking.length > 0) {
    reasons.push(`${plan.blocking.length} problem(s) have to be fixed before the import.`);
  }
  const undecided = plan.conflicts.filter((conflict) => !decided.includes(conflict.id));
  if (undecided.length > 0) reasons.push(`${undecided.length} conflict(s) need a decision.`);
  if (undecidedDomains > 0) {
    reasons.push(`${undecidedDomains} logical type conflict(s) need a decision.`);
  }
  if (reasons.length === 0) reasons.push("Choose where the import goes.");
  return reasons;
}
