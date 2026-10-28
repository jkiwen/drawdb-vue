import type { RelationshipId } from "./relationship.ts";

/**
 * A logical relationship (erwin: Logical Relationship, spec section 3.7.4).
 * Linked to its physical counterpart — a `Relationship` (the FK
 * implementation) — by sharing the same id (INV-6). Logical-only
 * relationships (many-to-many, subtype) may explicitly declare
 * `physicalPending` while they have no physical implementation.
 */
export interface LogicalRelationship {
  /** The same id as the linked physical `Relationship` (INV-6). */
  id: RelationshipId;
  /** The logical relationship name. */
  name?: string;
  /** Parent-side verb phrase (erwin: Parent Phrase). */
  parentRole?: string;
  /** Child-side verb phrase (erwin: Child Phrase). */
  childRole?: string;
  cardinality?: string;
  relationshipType?:
    | "identifying"
    | "non-identifying"
    | "many-to-many"
    | "subtype";
  /**
   * Explicitly declared as not yet physically implemented (INV-6
   * exemption). Without this flag a logical relationship lacking a physical
   * counterpart is a data defect (lint RELATIONSHIP_NOT_IMPLEMENTED).
   */
  physicalPending?: boolean;
}
