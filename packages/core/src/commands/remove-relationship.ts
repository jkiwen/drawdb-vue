import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Relationship, RelationshipId } from "../models/relationship.ts";
import { deepClone } from "../utils/clone.ts";

export class RemoveRelationshipCommand implements Command {
  private readonly diagram: Diagram;
  private readonly relationshipId: RelationshipId;
  private removedRelationship: Relationship | undefined;
  private removedIndex = -1;

  constructor(
    diagram: Diagram,
    relationshipId: RelationshipId,
  ) {
    this.diagram = diagram;
    this.relationshipId = relationshipId;
  }

  get description(): string {
    return `Remove relationship ${
      this.removedRelationship?.name ?? this.relationshipId
    }`;
  }

  execute(): void {
    const idx = this.diagram.relationships.findIndex(
      (r) => r.id === this.relationshipId,
    );
    if (idx < 0) return;

    this.removedIndex = idx;
    this.removedRelationship = deepClone(this.diagram.relationships[idx]);
    this.diagram.relationships.splice(idx, 1);
  }

  undo(): void {
    if (!this.removedRelationship || this.removedIndex < 0) return;

    const idx = Math.min(this.removedIndex, this.diagram.relationships.length);
    this.diagram.relationships.splice(idx, 0, this.removedRelationship);
    this.removedRelationship = undefined;
    this.removedIndex = -1;
  }
}
