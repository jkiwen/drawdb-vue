import type { Command } from "./command.ts";
import type { DatabaseType, Diagram } from "../models/diagram.ts";

/**
 * The top level properties of a diagram that the editor can change.
 *
 * They are kept separate from the collections, because they belong to the
 * diagram itself and not to one of its elements.
 */
export interface DiagramProperties {
  title?: string;
  database?: DatabaseType;
  sqlHeader?: string;
}

/**
 * Changes a top level property of the diagram, for example the title or the
 * database the diagram is written for.
 */
export class UpdateDiagramCommand implements Command {
  private readonly diagram: Diagram;
  private readonly updates: DiagramProperties;
  private previous: DiagramProperties = {};

  constructor(diagram: Diagram, updates: DiagramProperties) {
    this.diagram = diagram;
    this.updates = updates;
  }

  get description(): string {
    const names = Object.keys(this.updates).join(", ");
    return `Update diagram (${names})`;
  }

  execute(): void {
    this.previous = {};
    const target = this.diagram as unknown as Record<string, unknown>;
    for (const key of Object.keys(this.updates) as Array<keyof DiagramProperties>) {
      const value = this.updates[key];
      if (value === undefined) continue;
      this.previous[key] = this.diagram[key] as never;
      target[key] = value;
    }
  }

  undo(): void {
    const target = this.diagram as unknown as Record<string, unknown>;
    for (const key of Object.keys(this.previous) as Array<keyof DiagramProperties>) {
      target[key] = this.previous[key] as never;
    }
    this.previous = {};
  }
}
