import type { Diagram } from "../models/diagram.ts";
import type { DiagramJson } from "./types.ts";

export interface ExportDiagramJsonOptions {
  /** The indentation of the json. */
  pretty?: boolean;
}

/**
 * Serializes a diagram as json.
 *
 * The result is the format that `importDiagramJson` reads, and the format of
 * the `.ddb` file of the React reference.
 */
export function exportDiagramJson(
  diagram: Diagram,
  options: ExportDiagramJsonOptions = {},
): string {
  const value: DiagramJson = {
    id: diagram.id,
    title: diagram.title,
    description: diagram.description,
    database: diagram.database,
    sqlHeader: diagram.sqlHeader,
    tables: diagram.tables ?? [],
    relationships: diagram.relationships ?? [],
    logicalRelationships: diagram.logicalRelationships ?? [],
    notes: diagram.notes ?? [],
    subjectAreas: diagram.areas ?? diagram.subjectAreas ?? [],
    types: diagram.types ?? [],
    enums: diagram.enums ?? [],
    views: diagram.views ?? [],
    metadata: diagram.metadata,
    viewState: diagram.viewState,
  };

  return JSON.stringify(value, null, options.pretty ? 2 : undefined);
}
