export type RelationshipId = string | number;

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
}
