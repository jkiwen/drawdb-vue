import { validateDiagram } from "../validation/validate.ts";
import { lintDialect } from "../validation/dialect-lint.ts";
import { validateRelationshipInvariants, validateTableInvariants } from "../models/invariants.ts";
import { emptyTypeScope } from "../types/resolve.ts";
import type { Diagram } from "../models/diagram.ts";
import type { TypeScopeSnapshot } from "../types/resolve.ts";
import type { ImportIssue, ImportSkip, ImportSource } from "./types.ts";

/** What the validator needs besides the source itself. */
export interface ValidateImportOptions {
  /** The type scope the dialect lint reads (defaults to the builtin one). */
  scope?: TypeScopeSnapshot;
}

/** The label the report shows for a table. */
function tablePath(diagram: Diagram, tableId: string | number | undefined): string {
  const table = diagram.tables.find((item) => String(item.id) === String(tableId));
  return table === undefined ? "Table" : `Table[${table.name}]`;
}

/**
 * The issues of a read: what the reader said (parse failures, erwin skips) plus
 * three levels of validation over the diagram it produced — structural
 * invariants, the diagram's own rules, and what the target dialect can express.
 *
 * Errors block an import; warnings and info are shown but do not.
 */
export function validateImport(
  source: ImportSource,
  options: ValidateImportOptions = {},
): ImportIssue[] {
  const issues: ImportIssue[] = [...source.issues];
  const diagram = source.diagram;
  if (diagram === null) {
    return issues;
  }

  for (const table of diagram.tables) {
    for (const violation of validateTableInvariants(table)) {
      issues.push({
        // INV-4 asks every field to have a paired logical attribute. An import
        // legitimately starts physical: SQL, DBML and erwin describe columns,
        // not entities. The diagram rules already report the unpaired fields as
        // PHYSICAL_ONLY, so the invariant is a warning here and never blocks a
        // file whose columns are complete.
        level: violation.code === "INV-4" ? "warning" : "error",
        code: violation.code,
        path: `Table[${table.name}]`,
        message: violation.message,
      });
    }
  }
  for (const violation of validateRelationshipInvariants(diagram)) {
    issues.push({
      level: "error",
      code: violation.code,
      path: "Relationship",
      message: violation.message,
    });
  }

  // The diagram rules include the key rules, so one call covers both.
  for (const issue of validateDiagram(diagram)) {
    issues.push({
      level: issue.severity,
      code: issue.code,
      path:
        issue.tableId === undefined
          ? "Diagram"
          : `${tablePath(diagram, issue.tableId)}${issue.fieldId === undefined ? "" : "/Column"}`,
      message: issue.message,
    });
  }

  const scope = options.scope ?? emptyTypeScope();
  for (const diagnostic of lintDialect(diagram, scope)) {
    issues.push({
      level: diagnostic.severity === "error" ? "error" : "warning",
      code: diagnostic.code,
      path:
        diagnostic.scope.tableId === undefined
          ? "Diagram"
          : `${tablePath(diagram, diagnostic.scope.tableId)}${diagnostic.scope.fieldId === undefined ? "" : "/Column"}`,
      message: diagnostic.message,
    });
  }

  return dedupe(issues);
}

/** The issues that must be settled before an import can run. */
export function blockingIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  return issues.filter((issue) => issue.level === "error");
}

/**
 * The repair mode: every blocking issue becomes a skip, so the parts of the
 * file that did read can still be imported (the P7 rule: lenient, not silent).
 */
export function repairMode(source: ImportSource, options: ValidateImportOptions = {}): ImportSkip[] {
  return blockingIssues(validateImport(source, options)).map((issue) => ({
    path: issue.path,
    sourceName: issue.code,
    reason: reasonOf(issue.code),
    detail: issue.message,
  }));
}

/** Why a blocking issue became a skip. */
function reasonOf(code: string): ImportSkip["reason"] {
  if (code === "import.parse_failed" || code.startsWith("json.")) {
    return "unparsable";
  }
  if (code.startsWith("erwin.unsupported")) {
    return "unsupported";
  }
  if (code.startsWith("index.") || code.startsWith("constraint.") || code.startsWith("table.")) {
    return "unparsable";
  }
  return "asymmetric";
}

/** The same issue can be reached from two validators (a key rule through the
 * diagram rules and through the key rules); the report shows it once. */
function dedupe(issues: readonly ImportIssue[]): ImportIssue[] {
  const seen = new Set<string>();
  const kept: ImportIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.level}|${issue.code}|${issue.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    kept.push(issue);
  }
  return kept;
}
