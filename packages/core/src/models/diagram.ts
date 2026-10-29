import type { Area } from "./area.ts";
import type { CustomType } from "./type.ts";
import type { Enum } from "./enum.ts";
import type { LogicalRelationship } from "./logical-relationship.ts";
import type { InvalidMarker } from "./invalid-marker.ts";
import type { Metadata } from "./metadata.ts";
import type { Note } from "./note.ts";
import type { Relationship } from "./relationship.ts";
import type { Table } from "./table.ts";
import { createDefaultViewState } from "./view-state.ts";
import type { ViewState } from "./view-state.ts";
import type { View } from "./view.ts";

export type DatabaseType =
  | "mysql"
  | "postgres"
  | "sqlite"
  | "mariadb"
  | "mssql"
  | "oraclesql"
  | "generic";

export interface Diagram {
  id?: string;
  title?: string;
  /**
   * What the diagram is for, in the words of whoever drew it (feature request
   * of 2026-10-29). A note on the drawing rather than on one of its tables.
   */
  description?: string;
  database: DatabaseType;
  sqlHeader?: string;
  tables: Table[];
  relationships: Relationship[];
  /**
   * Logical relationships (spec section 3.7.4). Linked to `relationships`
   * by id (INV-6); absent for diagrams that predate the two-layer model.
   */
  logicalRelationships?: LogicalRelationship[];
  notes: Note[];
  subjectAreas: Area[];
  areas?: Area[];
  types: CustomType[];
  enums: Enum[];
  views: View[];
  metadata?: Metadata;
  /**
   * The pieces of an imported file the reader could not turn into a value
   * (P7, ruling Q18): the diagram stays valid and the report points at what
   * the user may want to fix by hand.
   */
  invalidMarkers?: InvalidMarker[];
  /**
   * The view state of the diagram (UI document section 9.2, ruling Q2):
   * saved with the diagram, restored on load, never part of the undo stack.
   * The zoom is session state and is not part of it.
   */
  viewState?: ViewState;
  lastModified?: string | Date;
  createdAt?: string | Date;
}

export interface CreateEmptyDiagramOptions {
  database?: DatabaseType;
  title?: string;
  id?: string;
}

export function createEmptyDiagram(
  options: CreateEmptyDiagramOptions = {},
): Diagram {
  return {
    id: options.id,
    title: options.title ?? "",
    database: options.database ?? "generic",
    sqlHeader: "",
    tables: [],
    relationships: [],
    logicalRelationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
    metadata: {},
    viewState: createDefaultViewState(),
  };
}
