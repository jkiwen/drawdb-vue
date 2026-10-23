import type { DatabaseType } from "../models/diagram.ts";

/** How serious an issue is. */
export type IssueSeverity = "error" | "warning";

/**
 * The kind of value a type accepts as a default.
 *
 * Re-exported from the type registry, which owns the classification of the
 * types of every dialect.
 */
export type { DefaultKind } from "../types/registry.ts";

/**
 * A single problem of a diagram.
 *
 * The core never localizes an issue: it reports a stable `code`, an English
 * fallback `message` and the `params` the SDK needs to build a translated
 * message.
 */
export interface DiagramIssue {
  /** A stable identifier, for example `table.no_primary_key`. */
  code: string;
  severity: IssueSeverity;
  /** The English fallback message. */
  message: string;
  /** The values a localized message is built from. */
  params?: Record<string, string>;
  tableId?: string;
  fieldId?: string;
  relationshipId?: string;
  viewId?: string;
  typeId?: string;
  enumName?: string;
}

/** The options of a validation run. */
export interface ValidationOptions {
  /** The dialect the diagram is written for; the diagram's own by default. */
  database?: DatabaseType;
  /** Only the issues of at least this severity are returned. */
  severity?: IssueSeverity;
}
