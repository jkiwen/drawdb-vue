import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Relationship } from "../models/relationship.ts";

export class AddRelationshipCommand implements Command {
  private readonly diagram: Diagram;
  private readonly relationship: Relationship;
  private readonly index: number;

  constructor(
    diagram: Diagram,
    relationship: Relationship,
    index?: number,
  ) {
    this.diagram = diagram;
    this.relationship = relationship;
    this.index = index ?? diagram.relationships.length;
  }

  get description(): string {
    return `Add relationship ${this.relationship.name ?? this.relationship.id}`;
  }

  execute(): void {
    const idx = Math.min(this.index, this.diagram.relationships.length);
    this.diagram.relationships.splice(idx, 0, this.relationship);
  }

  undo(): void {
    const idx = this.diagram.relationships.findIndex(
      (r) => r.id === this.relationship.id,
    );
    if (idx >= 0) {
      this.diagram.relationships.splice(idx, 1);
    }
  }
}
