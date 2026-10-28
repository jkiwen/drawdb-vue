export { isDefaultValid, resolveDefaultKind, validateDiagram } from "./validate.ts";
export { lintDialect } from "./dialect-lint.ts";
export type {
  DialectDiagnostic,
  DialectDiagnosticCode,
  DialectSeverity,
} from "./dialect-lint.ts";
export type {
  DefaultKind,
  DiagramIssue,
  IssueSeverity,
  ValidationOptions,
} from "./types.ts";
