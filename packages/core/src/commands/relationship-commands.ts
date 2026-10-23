import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import type {
  Relationship,
  RelationshipId,
} from "../models/relationship.ts";
import { deepClone } from "../utils/clone.ts";

/**
 * Adds a relationship between two tables.
 */
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

/**
 * Adds a batch of relationships at once, for example the candidates of the
 * automatic inference.
 */
export class AddRelationshipsCommand implements Command {
  private readonly diagram: Diagram;
  private readonly relationships: Relationship[];

  constructor(diagram: Diagram, relationships: Relationship[]) {
    this.diagram = diagram;
    this.relationships = relationships;
  }

  get description(): string {
    return `Add ${this.relationships.length} relationships`;
  }

  execute(): void {
    for (const relationship of this.relationships) {
      this.diagram.relationships.push(relationship);
    }
  }

  undo(): void {
    const ids = new Set(this.relationships.map((r) => String(r.id)));
    this.diagram.relationships = this.diagram.relationships.filter(
      (r) => !ids.has(String(r.id)),
    );
  }
}

/**
 * Changes a relationship.
 */
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

/**
 * Removes a relationship.
 */
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
