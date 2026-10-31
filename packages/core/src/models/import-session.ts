import type { ImportFormat } from "../import/types.ts";

/**
 * One recorded import (design section 6.1).
 *
 * It is part of the document and not of the session: the history of "where did
 * these tables come from" has to travel with the diagram it explains.
 */
export interface ImportSession {
  id: string;
  startedAt: string;
  finishedAt?: string;
  source: {
    kind: "file" | "text" | "host";
    format: ImportFormat;
    fileName?: string;
    bytes: number;
    version?: string;
  };
  target: { kind: "new" | "current"; diagramId?: string; title: string };
  decisions: {
    conflicts: { id: string; action: string }[];
    registerDomains: boolean;
    keepCoordinates: boolean;
  };
  counts: {
    tables: number;
    fields: number;
    keys: number;
    relationships: number;
    domains: number;
    notes: number;
    areas: number;
    skipped: number;
  };
  entries: ImportAuditEntry[];
  outcome: "applied" | "aborted" | "failed";
  error?: string;
}

/** One line of an import session: what was found, and on what. */
export interface ImportAuditEntry {
  level: "error" | "warning" | "info";
  /** The code of the reader or of the validator, e.g. `index.unknown_field`. */
  code: string;
  /** Where in the source, e.g. `Table[users]/Column[id]`. */
  path: string;
  message: string;
  subject?: {
    kind: "table" | "field" | "key" | "relationship" | "domain";
    id?: string;
    name?: string;
  };
}
