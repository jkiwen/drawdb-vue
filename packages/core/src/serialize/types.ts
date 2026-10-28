import type { Area } from "../models/area.ts";
import type { DatabaseType } from "../models/diagram.ts";
import type { Enum } from "../models/enum.ts";
import type { LogicalRelationship } from "../models/logical-relationship.ts";
import type { Metadata } from "../models/metadata.ts";
import type { Note } from "../models/note.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import type { CustomType } from "../models/type.ts";
import type { ViewState } from "../models/view-state.ts";
import type { View } from "../models/view.ts";

/**
 * The JSON format of a diagram: the shape of the file that the export writes
 * and that the import reads.
 */
export interface DiagramJson {
  id?: string;
  title?: string;
  database: DatabaseType;
  sqlHeader?: string;
  tables: Table[];
  relationships: Relationship[];
  logicalRelationships?: LogicalRelationship[];
  notes: Note[];
  subjectAreas: Area[];
  types: CustomType[];
  enums: Enum[];
  views: View[];
  metadata?: Metadata;
  viewState?: ViewState;
}

/** A message that explains why an import failed. */
export interface ImportDiagnostic {
  message: string;
  line?: number;
  column?: number;
}

/**
 * The error that an import throws.
 *
 * The code is one of `json.parse_failed`, `json.invalid_shape`,
 * `relationship.missing_table`, `relationship.missing_field` and
 * `database.mismatch`.
 */
export class ImportError extends Error {
  readonly code: string;
  readonly diagnostics: ImportDiagnostic[];

  constructor(
    code: string,
    message: string,
    diagnostics: ImportDiagnostic[] = [],
  ) {
    super(message);
    this.name = "ImportError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}
