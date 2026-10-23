import type { Command } from "./command.ts";
import type { Diagram } from "../models/diagram.ts";
import { deepClone } from "../utils/clone.ts";

/** Collections of a diagram that hold flat, identifiable entities. */
export type DiagramEntityCollection =
  | "notes"
  | "areas"
  | "subjectAreas"
  | "types"
  | "enums"
  | "views";

export interface DiagramEntity {
  id?: string | number;
  name?: string;
}

/** The identity of an entity: its id, or its name when it has no id. */
function identity(entity: DiagramEntity): string | number | undefined {
  return entity.id ?? entity.name;
}

/** True when the entity is the one that the target addresses. */
function matches(entity: DiagramEntity, target: string | number | undefined): boolean {
  if (target === undefined) return false;
  if (identity(entity) === target) return true;
  return typeof target === "string" && entity.name === target;
}

/**
 * Adds an entity to one of the flat diagram collections. Notes, areas,
 * subject areas, custom types, enums and views all share the same shape, so a
 * single command covers them.
 */
export class AddEntityCommand implements Command {
  private readonly diagram: Diagram;
  private readonly collection: DiagramEntityCollection;
  private readonly entity: DiagramEntity;

  constructor(
    diagram: Diagram,
    collection: DiagramEntityCollection,
    entity: DiagramEntity,
  ) {
    this.diagram = diagram;
    this.collection = collection;
    this.entity = entity;
  }

  get description(): string {
    return `Add ${this.collection.replace(/s$/, "")} ${
      this.entity.name ?? this.entity.id ?? ""
    }`.trim();
  }

  private list(): DiagramEntity[] {
    return (this.diagram[this.collection] ??= []) as unknown as DiagramEntity[];
  }

  execute(): void {
    const list = this.list();
    list.push(this.entity);
  }

  undo(): void {
    const list = this.list();
    const target = identity(this.entity);
    const idx = list.findIndex((item) => matches(item, target));
    if (idx < 0) return;

    list.splice(idx, 1);
  }
}

/**
 * Changes an entity of one of the flat diagram collections.
 */
export class UpdateEntityCommand implements Command {
  private readonly diagram: Diagram;
  private readonly collection: DiagramEntityCollection;
  private readonly target: string | number | undefined;
  private readonly updates: Record<string, unknown>;
  private previousEntity: DiagramEntity | undefined;

  constructor(
    diagram: Diagram,
    collection: DiagramEntityCollection,
    target: string | number | undefined,
    updates: Record<string, unknown>,
  ) {
    this.diagram = diagram;
    this.collection = collection;
    this.target = target;
    this.updates = updates;
  }

  get description(): string {
    return `Update ${this.collection.replace(/s$/, "")} ${this.target ?? ""}`.trim();
  }

  private list(): DiagramEntity[] {
    return (this.diagram[this.collection] ??= []) as unknown as DiagramEntity[];
  }

  execute(): void {
    const list = this.list();
    const idx = list.findIndex((item) => matches(item, this.target));
    if (idx < 0) return;

    const current = list[idx];
    this.previousEntity = deepClone(current);
    list[idx] = { ...current, ...this.updates } as DiagramEntity;
  }

  undo(): void {
    if (!this.previousEntity) return;

    const list = this.list();
    const idx = list.findIndex((item) => matches(item, this.target));
    if (idx < 0) return;

    list[idx] = this.previousEntity;
  }
}

/**
 * Removes an entity from one of the flat diagram collections.
 */
export class RemoveEntityCommand implements Command {
  private readonly diagram: Diagram;
  private readonly collection: DiagramEntityCollection;
  private readonly target: string | number | undefined;
  private removedEntity: DiagramEntity | undefined;
  private removedIndex = -1;

  constructor(
    diagram: Diagram,
    collection: DiagramEntityCollection,
    target: string | number | undefined,
  ) {
    this.diagram = diagram;
    this.collection = collection;
    this.target = target;
  }

  get description(): string {
    return `Remove ${this.collection.replace(/s$/, "")} ${
      this.removedEntity?.name ?? this.target ?? ""
    }`.trim();
  }

  private list(): DiagramEntity[] {
    return (this.diagram[this.collection] ??= []) as unknown as DiagramEntity[];
  }

  execute(): void {
    const list = this.list();
    const idx = list.findIndex((item) => matches(item, this.target));
    if (idx < 0) return;

    this.removedIndex = idx;
    this.removedEntity = list[idx];
    list.splice(idx, 1);
  }

  undo(): void {
    if (!this.removedEntity || this.removedIndex < 0) return;

    const list = this.list();
    const idx = Math.min(this.removedIndex, list.length);
    list.splice(idx, 0, this.removedEntity);
    this.removedEntity = undefined;
    this.removedIndex = -1;
  }
}
