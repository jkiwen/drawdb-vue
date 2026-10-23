import type { DatabaseType } from "../models/diagram.ts";
import {
  getTypeMetadata as getGeneratedTypeMetadata,
  type TypeMetadata,
} from "../types/registry.ts";

export type { TypeMetadata };

/**
 * Capability metadata for a type in a dialect.
 *
 * The table is generated from the React drawDB type tables by
 * `scripts/generate-type-registry.mjs`, so every dialect shares one source
 * of truth.
 */
export function getTypeMetadata(
  database: string,
  type: string,
): TypeMetadata | undefined {
  return getGeneratedTypeMetadata(database as DatabaseType, type);
}
