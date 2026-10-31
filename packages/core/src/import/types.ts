import type { DatabaseType, Diagram } from "../models/diagram.ts";
import type { ErwinImportReport } from "../erwin/erwin-import.ts";

/** The shapes the import wizard can read. */
export type ImportFormat = "sql" | "dbml" | "json" | "erwin";

/** How serious an import issue is: errors block, warnings suggest, info records. */
export type ImportIssueLevel = "error" | "warning" | "info";

/**
 * One thing the reader or the validator has to say about an import.
 *
 * `path` is a readable location (`Entity[19]`, `Table[users]/Column[id]`) so the
 * report can point at the element without carrying object references around.
 */
export interface ImportIssue {
  level: ImportIssueLevel;
  code: string;
  path: string;
  message: string;
}

/** What an import read but could not place (the erwin report's counterpart). */
export interface ImportSkip {
  path: string;
  sourceName?: string;
  reason: "unsupported" | "unparsable" | "unknown-element" | "asymmetric";
  detail?: string;
}

/** How much a diagram holds, for the review step and the audit. */
export interface ImportCounts {
  tables: number;
  fields: number;
  keys: number;
  relationships: number;
  domains: number;
  notes: number;
  areas: number;
  /** Pieces of the file the reader had to skip, when it knows. */
  skipped?: number;
}

/** Options of a read: the format decides which reader runs. */
export interface BuildImportSourceOptions {
  format: ImportFormat;
  database?: DatabaseType;
  fileName?: string;
  title?: string;
}

/**
 * What one read produced: the candidate diagram (never applied here), the
 * issues it raised, and the report/version a format is able to give.
 */
export interface ImportSource {
  format: ImportFormat;
  database: DatabaseType;
  fileName?: string;
  bytes: number;
  diagram: Diagram | null;
  version?: string;
  report?: ErwinImportReport;
  issues: ImportIssue[];
}
