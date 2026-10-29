import type { Diagram } from "../models/diagram.ts";
import {
  checkDefaultValues,
  checkEnums,
  checkFields,
  checkIndices,
  checkInheritedFields,
  checkPrimaryKeys,
  checkRelationships,
  checkTableNames,
  checkTypes,
  checkViews,
} from "./rules.ts";
import { checkKeys } from "./key-rules.ts";
import type { DiagramIssue, ValidationOptions } from "./types.ts";

export { isDefaultValid, resolveDefaultKind } from "./rules.ts";
export type {
  DefaultKind,
  DiagramIssue,
  IssueSeverity,
  ValidationOptions,
} from "./types.ts";

/** The order of the severities, used by the `severity` option of a run. */
const SEVERITY_RANK: Record<"error" | "warning" | "info", number> = {
  error: 2,
  warning: 1,
  info: 0,
};

/** The code of the issue that reports a failure of the validation itself. */
const INTERNAL_ERROR = "validation.internal_error";

/**
 * Validates a diagram and returns the issues it found.
 *
 * The validator never throws: a malformed diagram is reported as a single
 * `validation.internal_error` issue.
 */
export function validateDiagram(
  diagram: Diagram,
  options: ValidationOptions = {},
): DiagramIssue[] {
  let issues: DiagramIssue[];

  try {
    issues = collect(diagram, options);
  } catch (error) {
    issues = [
      {
        code: INTERNAL_ERROR,
        severity: "error",
        message:
          error instanceof Error
            ? `The diagram could not be validated: ${error.message}`
            : "The diagram could not be validated.",
        params: {},
      },
    ];
  }

  if (options.severity) {
    const floor = SEVERITY_RANK[options.severity];
    issues = issues.filter((issue) => SEVERITY_RANK[issue.severity] >= floor);
  }

  return issues;
}

/** Runs every rule and collects the issues. */
function collect(
  diagram: Diagram,
  options: ValidationOptions,
): DiagramIssue[] {
  if (!diagram || !Array.isArray(diagram.tables)) {
    throw new Error("The diagram has no table list.");
  }

  const database = options.database ?? diagram.database;

  return [
    ...checkTableNames(diagram),
    ...checkFields(diagram),
    ...checkPrimaryKeys(diagram),
    ...checkDefaultValues(diagram, database),
    ...checkInheritedFields(diagram),
    ...checkIndices(diagram),
    ...checkKeys(diagram),
    ...checkTypes(diagram),
    ...checkEnums(diagram),
    ...checkViews(diagram),
    ...checkRelationships(diagram),
  ];
}
