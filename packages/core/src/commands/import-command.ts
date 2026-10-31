import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Note } from "../models/note.ts";
import type { Area } from "../models/area.ts";
import type { Relationship } from "../models/relationship.ts";
import type { LogicalRelationship } from "../models/logical-relationship.ts";
import type { Table } from "../models/table.ts";
import type { CustomType } from "../models/type.ts";
import type { Enum } from "../models/enum.ts";
import type { View } from "../models/view.ts";
import type { LogicalDomain } from "../models/domain.ts";
import type { InvalidMarker } from "../models/invalid-marker.ts";
import type { ImportSession } from "../models/import-session.ts";
import type { DatabaseType } from "../models/diagram.ts";
import { cloneDiagram } from "../import/clone.ts";

/** Everything an import can replace in a document. */
interface DocumentSnapshot {
  title?: string;
  description?: string;
  database: DatabaseType;
  sqlHeader?: string;
  tables: Table[];
  relationships: Relationship[];
  logicalRelationships?: LogicalRelationship[];
  notes: Note[];
  subjectAreas: Area[];
  areas?: Area[];
  types: CustomType[];
  enums: Enum[];
  views: View[];
  domains?: LogicalDomain[];
  imports?: ImportSession[];
  invalidMarkers?: InvalidMarker[];
}

function copy<T>(value: T[] | undefined): T[] | undefined {
  return value === undefined ? undefined : [...value];
}

/**
 * A picture of the document that can be put back later.
 *
 * The collections are copied one level deep and not cloned: the import builds
 * a new document, so the old arrays are never touched afterwards and their
 * elements are exactly what undo has to restore. A deep copy would also cost
 * 10-20 MB on a diagram of 500 tables (P8 plan, risk 1) and would break on the
 * reactive objects the editor holds.
 */
function snapshotOf(diagram: Diagram): DocumentSnapshot {
  return {
    title: diagram.title,
    description: diagram.description,
    database: diagram.database,
    sqlHeader: diagram.sqlHeader,
    tables: copy(diagram.tables) ?? [],
    relationships: copy(diagram.relationships) ?? [],
    logicalRelationships: copy(diagram.logicalRelationships),
    notes: copy(diagram.notes) ?? [],
    subjectAreas: copy(diagram.subjectAreas) ?? [],
    areas: copy(diagram.areas),
    types: copy(diagram.types) ?? [],
    enums: copy(diagram.enums) ?? [],
    views: copy(diagram.views) ?? [],
    domains: copy(diagram.domains),
    imports: copy(diagram.imports),
    invalidMarkers: copy(diagram.invalidMarkers),
  };
}

/**
 * Puts the result of an import into the document as one step of the history.
 *
 * The import itself is decided by `planImport`/`applyImport` (P8 tasks 3 and
 * 4); this command only carries the outcome, so undo puts the document back
 * exactly as it was, including its import record.
 */
export class ImportCommand implements Command {
  private readonly diagram: Diagram;
  private readonly next: DocumentSnapshot;
  private readonly label: string;
  private previous: DocumentSnapshot | null = null;

  constructor(diagram: Diagram, next: Diagram, label = "Import") {
    this.diagram = diagram;
    this.next = snapshotOf(cloneDiagram(toPlain(next)));
    this.label = label;
  }

  get description(): string {
    return this.label;
  }

  execute(): void {
    this.previous = snapshotOf(this.diagram);
    const target = this.diagram as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(this.next)) {
      if (value === undefined) {
        delete target[key];
        continue;
      }
      target[key] = value;
    }
  }

  undo(): void {
    if (this.previous === null) return;
    const target = this.diagram as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(this.previous)) {
      if (value === undefined) {
        delete target[key];
        continue;
      }
      target[key] = value;
    }
    this.previous = null;
  }
}

/** The plain data behind a reactive document, for the one deep copy we make. */
function toPlain(diagram: Diagram): Diagram {
  return JSON.parse(JSON.stringify(diagram)) as Diagram;
}
