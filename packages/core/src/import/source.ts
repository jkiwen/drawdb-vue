import { importSQL } from "../sql/import/index.ts";
import { parseDBML } from "../dbml/parse.ts";
import { importDiagramJson } from "../serialize/import.ts";
import { ImportError } from "../serialize/types.ts";
import { importErwinXml } from "../erwin/erwin-import.ts";
import type { Diagram } from "../models/diagram.ts";
import type {
  BuildImportSourceOptions,
  ImportCounts,
  ImportFormat,
  ImportSource,
} from "./types.ts";

/**
 * The code an issue carries: the reader's own code when it has one, a generic
 * one otherwise, so the report can group failures without parsing messages.
 */
function codeOf(error: unknown): string {
  if (error instanceof ImportError && error.code.length > 0) {
    return error.code;
  }
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.length > 0 ? code : "import.parse_failed";
}

/** The bytes of a source as UTF-8, so the review step can show a size. */
function byteLength(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

/** Reads a JSON diagram, falling back to the diagram JSON importer. */
function readJson(raw: string, options: BuildImportSourceOptions): Diagram {
  return importDiagramJson(raw, { database: options.database });
}

/**
 * Reads the source the user gave into a candidate diagram, **without touching
 * any document**. Parsing failures come back as issues rather than exceptions so
 * the wizard can show them in the review step.
 */
export function buildImportSource(
  raw: string,
  options: BuildImportSourceOptions,
): ImportSource {
  const database = options.database ?? "generic";
  const base: ImportSource = {
    format: options.format,
    database,
    fileName: options.fileName,
    bytes: byteLength(raw),
    diagram: null,
    issues: [],
  };

  try {
    if (options.format === "sql") {
      base.diagram = importSQL(raw, database);
    } else if (options.format === "dbml") {
      base.diagram = parseDBML(raw, { database, title: options.title });
    } else if (options.format === "json") {
      base.diagram = readJson(raw, options);
    } else {
      const imported = importErwinXml(raw, { database, title: options.title });
      base.diagram = imported.diagram;
      base.report = imported.report;
      base.version = imported.report.version;
      // What the reader could not place is worth saying once, at read time;
      // the validator adds what is wrong with the diagram it did produce.
      for (const skip of imported.report.skipped) {
        base.issues.push({
          level: "warning",
          code: `erwin.${skip.reason}`,
          path: skip.path,
          message: skip.detail ?? `Skipped ${skip.sourceName ?? "an element"}.`,
        });
      }
    }
  } catch (error) {
    base.diagram = null;
    base.issues.push({
      level: "error",
      code: codeOf(error),
      path: options.format === "erwin" ? "ERwin" : options.format.toUpperCase(),
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return base;
}

/** Counts what a diagram holds; a missing diagram counts as empty. */
export function countDiagram(diagram: Diagram | null): ImportCounts {
  if (diagram === null) {
    return { tables: 0, fields: 0, keys: 0, relationships: 0, domains: 0, notes: 0, areas: 0 };
  }
  let fields = 0;
  let keys = 0;
  for (const table of diagram.tables) {
    fields += table.fields.length;
    keys += table.primaryKey === undefined ? 0 : 1;
    keys += table.uniqueKeys?.length ?? 0;
    keys += table.foreignKeys?.length ?? 0;
    keys += table.indices?.length ?? 0;
  }
  return {
    tables: diagram.tables.length,
    fields,
    keys,
    relationships: diagram.relationships.length,
    domains: 0,
    notes: diagram.notes.length,
    areas: diagram.areas?.length ?? 0,
  };
}

/** The formats a file name suggests, used by the drag-and-drop entry. */
export function formatOfFileName(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".sql")) {
    return "sql";
  }
  if (lower.endsWith(".dbml")) {
    return "dbml";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".xml")) {
    return "erwin";
  }
  return null;
}
