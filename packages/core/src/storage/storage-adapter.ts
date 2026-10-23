import type { Diagram } from "../models/diagram.ts";
import { deepClone } from "../utils/clone.ts";

/**
 * Persistence contract used by the SDK.
 *
 * Implementations are expected to be asynchronous and to never throw for a
 * missing record: `load` resolves to `undefined` instead.
 */
export interface StorageAdapter {
  /** Load a diagram by id. Resolves to `undefined` when it does not exist. */
  load(id: string): Promise<Diagram | undefined>;
  /** Insert or update a diagram. The diagram must carry an `id`. */
  save(diagram: Diagram): Promise<void>;
  /** Remove a diagram. Removing an unknown id is a no-op. */
  delete(id: string): Promise<void>;
  /** Return every stored diagram. */
  list(): Promise<Diagram[]>;
  /** Return the ids of every stored diagram. */
  listIds(): Promise<string[]>;
  /** Remove every stored diagram. */
  clear(): Promise<void>;
  /** Release any underlying resource. Optional. */
  close?(): Promise<void>;
}

export type StorageErrorCode =
  | "invalid-id"
  | "not-found"
  | "unavailable"
  | "unknown";

/** Error thrown by storage adapters. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/** Throw a `StorageError` when a diagram has no usable id. */
export function assertDiagramId(diagram: Diagram): string {
  const id = typeof diagram.id === "string" ? diagram.id.trim() : "";
  if (!id) {
    throw new StorageError(
      "invalid-id",
      "Cannot save a diagram without an id.",
    );
  }
  return id;
}

/** Deep clone a diagram so stored data never aliases caller state. */
export function cloneDiagram(diagram: Diagram): Diagram {
  return deepClone(diagram);
}
