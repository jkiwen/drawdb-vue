export type RelationshipId = string | number;

/** A single column pair of a (possibly composite) foreign key. */
export interface RelationshipFieldPair {
  startFieldId: RelationshipId;
  endFieldId: RelationshipId;
}

export interface Relationship {
  id: RelationshipId;
  startTableId: RelationshipId;
  startFieldId: RelationshipId;
  endTableId: RelationshipId;
  endFieldId: RelationshipId;
  name?: string;
  cardinality?: string;
  updateConstraint?: string;
  deleteConstraint?: string;
  /** Column pairs for composite foreign keys; the first pair mirrors start/end field ids. */
  fields?: RelationshipFieldPair[];
}
