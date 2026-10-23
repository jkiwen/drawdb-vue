import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Relationship, RelationshipId } from "../models/relationship.ts";
import { deepClone } from "../utils/clone.ts";

export class UpdateRelationshipCommand implements Command {
  private readonly diagram: Diagram;
  private readonly relationshipId: RelationshipId;
  private readonly updates: Partial<Omit<Relationship, "id">>;
  private previousRelationship: Relationship | undefined;

  constructor(
    diagram: Diagram,
    relationshipId: RelationshipId,
    updates: Partial<Omit<Relationship, "id">>,
  ) {
    this.diagram = diagram;
    this.relationshipId = relationshipId;
    this.updates = updates;
  }

  get description(): string {
    return `Update relationship ${
      this.previousRelationship?.name ?? this.relationshipId
    }`;
  }

  execute(): void {
    const idx = this.diagram.relationships.findIndex(
      (r) => r.id === this.relationshipId,
    );
    if (idx < 0) return;

    const target = this.diagram.relationships[idx];
    this.previousRelationship = deepClone(target);
    this.diagram.relationships[idx] = { ...target, ...this.updates };
  }

  undo(): void {
    if (!this.previousRelationship) return;

    const idx = this.diagram.relationships.findIndex(
      (r) => r.id === this.relationshipId,
    );
    if (idx < 0) return;

    this.diagram.relationships[idx] = this.previousRelationship;
  }
}
