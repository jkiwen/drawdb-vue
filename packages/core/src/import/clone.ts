import type { Diagram } from "../models/diagram.ts";

/** A deep copy of plain data (the editor holds no Maps or Sets in a document). */
export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A copy of a document that can be written to without touching the original.
 *
 * `structuredClone` cannot copy the reactive object the editor holds, and a
 * plain JSON copy would turn the two dates of a diagram into strings, so the
 * dates are put back as they were.
 */
export function cloneDiagram(diagram: Diagram): Diagram {
  const clone = cloneValue(diagram);
  if (diagram.createdAt instanceof Date) clone.createdAt = new Date(diagram.createdAt);
  if (diagram.lastModified instanceof Date) clone.lastModified = new Date(diagram.lastModified);
  return clone;
}
