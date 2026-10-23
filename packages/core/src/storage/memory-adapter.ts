import type { Diagram } from "../models/diagram.ts";
import {
  assertDiagramId,
  cloneDiagram,
  type StorageAdapter,
} from "./storage-adapter.ts";

/**
 * In-memory storage adapter.
 *
 * Useful for tests, server-side rendering and controlled integrations where
 * the host application owns persistence.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly diagrams = new Map<string, Diagram>();

  async load(id: string): Promise<Diagram | undefined> {
    const diagram = this.diagrams.get(id);
    return diagram ? cloneDiagram(diagram) : undefined;
  }

  async save(diagram: Diagram): Promise<void> {
    const id = assertDiagramId(diagram);
    this.diagrams.set(id, cloneDiagram(diagram));
  }

  async delete(id: string): Promise<void> {
    this.diagrams.delete(id);
  }

  async list(): Promise<Diagram[]> {
    return Array.from(this.diagrams.values(), cloneDiagram);
  }

  async listIds(): Promise<string[]> {
    return Array.from(this.diagrams.keys());
  }

  async clear(): Promise<void> {
    this.diagrams.clear();
  }
}
