import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  ImportCommand,
  appendImportSession,
  applyImport,
  buildImportSource,
  cloneDiagram,
  createEmptyDiagram,
  createImportSession,
  planImport,
} from "@drawdb/core";
import type {
  ConflictAction,
  DatabaseType,
  Diagram,
  DomainDecision,
  ImportFormat,
  ImportPlan,
  ImportPlanDecisions,
  ImportSource,
} from "@drawdb/core";
import { useDiagramStore } from "./diagram.ts";
import { useHistoryStore } from "./history.ts";
import { blockedReasons, nextStep, previousStep } from "../components/Import/import-wizard-model.ts";
import { t } from "../i18n/index.ts";
import type { ImportStep } from "../components/Import/import-wizard-model.ts";

/**
 * The state of the import wizard (P8 tasks 6 and 7).
 *
 * The wizard never decides anything by itself: conflicts start without a
 * choice, tables start all selected, and the plan stays `blocked` until every
 * question has an answer. That is the design's rule (section 3.4), and it is
 * why `apply()` re-plans instead of trusting the last plan it showed.
 */
export const useImportWizardStore = defineStore("import-wizard", () => {
  const diagramStore = useDiagramStore();
  const history = useHistoryStore();

  const open = ref(false);
  const step = ref<ImportStep>("source");
  const format = ref<ImportFormat>("sql");
  const database = ref<DatabaseType>("generic");
  const text = ref("");
  const fileName = ref<string | undefined>(undefined);
  const source = ref<ImportSource | null>(null);
  const plan = ref<ImportPlan | null>(null);
  const targetChoice = ref<"current" | "new">("current");
  const repair = ref(false);
  const registerDomains = ref(false);
  const conflictDecisions = ref<{ id: string; action: ConflictAction }[]>([]);
  const domainDecisions = ref<DomainDecision[]>([]);
  const chosenTables = ref<string[] | undefined>(undefined);
  const error = ref("");
  const outcome = ref<{ tables: number } | null>(null);
  const startedAt = ref("");

  const decisions = computed<ImportPlanDecisions>(() => ({
    target: targetChoice.value,
    repair: repair.value,
    registerDomains: registerDomains.value,
    conflicts: conflictDecisions.value,
    domains: domainDecisions.value,
    tables: chosenTables.value,
  }));

  const decidedIds = computed(() => conflictDecisions.value.map((entry) => entry.id));
  const undecidedDomains = computed(() =>
    (plan.value?.domainConflicts ?? []).filter(
      (conflict) =>
        !domainDecisions.value.some(
          (decision) => decision.name === conflict.name && decision.kind === conflict.kind,
        ),
    ),
  );
  const reasons = computed(() =>
    blockedReasons(plan.value, decidedIds.value, undecidedDomains.value.length).map((reason) =>
      reason.count === undefined ? t(reason.key) : t(reason.key, { count: reason.count }),
    ),
  );
  const canNext = computed(() => {
    if (step.value === "source") return text.value.trim().length > 0;
    if (step.value === "report") return plan.value !== null && (plan.value.blocking.length === 0 || repair.value);
    if (step.value === "target") return plan.value !== null;
    if (step.value === "conflict") return plan.value?.status === "ready";
    return false;
  });

  function replan(): void {
    source.value = null;
    plan.value = null;
    error.value = "";
    if (text.value.trim().length === 0) return;
    const built = buildImportSource(text.value, {
      format: format.value,
      database: database.value,
      fileName: fileName.value,
    });
    source.value = built;
    const target = targetChoice.value === "new" ? null : diagramStore.diagram;
    plan.value = planImport(built, target, decisions.value);
    const failure = built.issues.find((issue) => issue.level === "error");
    if (built.diagram === null && failure !== undefined) error.value = failure.message;
  }

  /**
   * Opens the wizard for one format, wiping whatever a previous run left.
   *
   * A dropped file arrives as `seed`: the wizard then starts with its text
   * already in the box, so the user goes straight to the report (P8 task 8).
   */
  function begin(
    next: ImportFormat = "sql",
    db?: DatabaseType,
    seed?: { text?: string; fileName?: string },
  ): void {
    open.value = true;
    step.value = "source";
    format.value = next;
    if (db !== undefined) database.value = db;
    text.value = seed?.text ?? "";
    fileName.value = seed?.fileName;
    source.value = null;
    plan.value = null;
    targetChoice.value = "current";
    repair.value = false;
    registerDomains.value = false;
    conflictDecisions.value = [];
    domainDecisions.value = [];
    chosenTables.value = undefined;
    error.value = "";
    outcome.value = null;
    startedAt.value = new Date().toISOString();
  }

  function close(): void {
    open.value = false;
    step.value = "source";
    outcome.value = null;
  }

  function back(): void {
    step.value = previousStep(step.value);
  }

  function advance(): void {
    // The source step reads the text as it moves on, so it cannot be gated on
    // a plan that only exists after the read.
    if (step.value === "source") {
      replan();
      if (source.value === null) return;
      step.value = "report";
      return;
    }
    if (step.value === "target") replan();
    if (!canNext.value) return;
    step.value = nextStep(step.value);
  }

  function setFormat(next: ImportFormat): void {
    format.value = next;
    replan();
  }

  function setTarget(next: "current" | "new"): void {
    targetChoice.value = next;
    replan();
  }

  function decide(id: string, action: ConflictAction): void {
    conflictDecisions.value = [
      ...conflictDecisions.value.filter((entry) => entry.id !== id),
      { id, action },
    ];
    replan();
  }

  function decideDomain(decision: DomainDecision): void {
    domainDecisions.value = [
      ...domainDecisions.value.filter(
        (entry) => !(entry.name === decision.name && entry.kind === decision.kind),
      ),
      decision,
    ];
    replan();
  }

  function toggleTable(id: string): void {
    const all = (source.value?.diagram?.tables ?? []).map((table) => String(table.id));
    const current = chosenTables.value ?? all;
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    chosenTables.value = next.length === all.length ? undefined : next;
    replan();
  }

  function setTables(ids: string[] | undefined): void {
    chosenTables.value = ids;
    replan();
  }

  function setRepair(value: boolean): void {
    repair.value = value;
    replan();
  }

  function setRegisterDomains(value: boolean): void {
    registerDomains.value = value;
    replan();
  }

  /** Applies the plan as one step of the history and records the session. */
  function apply(): boolean {
    if (source.value === null) return false;
    // A new diagram is the file itself: applyImport() merges into a document
    // that already exists, so there is nothing to merge into here.
    const result =
      targetChoice.value === "new"
        ? {
            applied: source.value.diagram !== null,
            diagram: cloneDiagram(source.value.diagram ?? createEmptyDiagram({ database: database.value })),
            issues: plan.value?.issues ?? [],
            plan: plan.value ?? planImport(source.value, null, decisions.value),
          }
        : applyImport(diagramStore.diagram, source.value, decisions.value);
    if (!result.applied) {
      error.value = result.issues.find((issue) => issue.level === "error")?.message ?? "The import cannot be applied.";
      return false;
    }
    const session = createImportSession({
      source: source.value,
      plan: result.plan,
      targetKind: targetChoice.value,
      targetTitle: result.diagram.title ?? "",
      diagramId: result.diagram.id,
      decisions: { conflicts: conflictDecisions.value, registerDomains: registerDomains.value, keepCoordinates: true },
      startedAt: startedAt.value === "" ? new Date().toISOString() : startedAt.value,
      finishedAt: new Date().toISOString(),
      outcome: "applied",
    });
    const next: Diagram = {
      ...result.diagram,
      imports: appendImportSession(result.diagram.imports, session),
    };
    history.execute(new ImportCommand(diagramStore.diagram, next, `Import ${format.value}`));
    diagramStore.refresh();
    outcome.value = { tables: result.diagram.tables.length };
    step.value = "apply";
    return true;
  }

  return {
    open,
    step,
    format,
    database,
    text,
    fileName,
    source,
    plan,
    targetChoice,
    repair,
    registerDomains,
    conflictDecisions,
    domainDecisions,
    chosenTables,
    error,
    outcome,
    decisions,
    decidedIds,
    undecidedDomains,
    reasons,
    canNext,
    begin,
    close,
    back,
    advance,
    setFormat,
    setTarget,
    decide,
    decideDomain,
    toggleTable,
    setTables,
    setRepair,
    setRegisterDomains,
    apply,
    replan,
  };
});
