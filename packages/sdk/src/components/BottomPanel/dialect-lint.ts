/**
 * The dialect lint channel of the core, re-exported under the bare package
 * specifier so the bottom panel stays inside the app -> sdk -> core
 * dependency direction.
 */
export { lintDialect, emptyTypeScope } from "@drawdb/core";
export type { DialectDiagnostic, DialectSeverity } from "@drawdb/core";
