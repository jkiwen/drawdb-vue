import { getRelationshipFields } from "../export/shared.ts";
import { Cardinality, Constraint } from "../models/constants.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";

/**
 * The singular form of a table name: `users` becomes `user`, `categories`
 * becomes `category`.
 */
function singularize(name: string): string {
  if (!name || typeof name !== "string") return "";
  const lower = name.trim().toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("es") && !lower.endsWith("sses")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

/** True when the field of the child table is already the start of a relationship. */
function isFieldAlreadyLinked(
  relationships: Relationship[],
  childTableId: string,
  fieldId: string,
): boolean {
  return relationships.some((relationship) => {
    if (String(relationship?.startTableId) !== String(childTableId)) {
      return false;
    }
    return getRelationshipFields(relationship).some(
      (pair) => String(pair.startFieldId) === String(fieldId),
    );
  });
}

/** True when the two fields are already the ends of a relationship. */
function isPairAlreadyLinked(
  relationships: Relationship[],
  childTableId: string,
  fkFieldId: string,
  parentTableId: string,
  pkFieldId: string,
): boolean {
  return relationships.some((relationship) => {
    const pairs = getRelationshipFields(relationship);
    const forward =
      String(relationship?.startTableId) === String(childTableId) &&
      String(relationship?.endTableId) === String(parentTableId) &&
      pairs.some(
        (pair) =>
          String(pair.startFieldId) === String(fkFieldId) &&
          String(pair.endFieldId) === String(pkFieldId),
      );
    const backward =
      String(relationship?.startTableId) === String(parentTableId) &&
      String(relationship?.endTableId) === String(childTableId) &&
      pairs.some(
        (pair) =>
          String(pair.startFieldId) === String(pkFieldId) &&
          String(pair.endFieldId) === String(fkFieldId),
      );
    return forward || backward;
  });
}

/**
 * Infers the relationships that the names of the fields suggest.
 *
 * A field of a child table whose name is the name of the table of the parent
 * followed by the name of its primary key (`user_id`, `users_id`, `userid`,
 * `usersid`) is a foreign key.
 */
export function inferRelationships(
  tables: Table[],
  existing: Relationship[] = [],
): Relationship[] {
  const tables_ = Array.isArray(tables) ? tables : [];
  const known: Relationship[] = Array.isArray(existing) ? [...existing] : [];
  const candidates: Relationship[] = [];

  for (const parentTable of tables_) {
    const pkIds = new Set(
      (parentTable?.primaryKey?.columns ?? []).map((column) =>
        String(column.fieldId),
      ),
    );
    const pkFields = (parentTable?.fields ?? []).filter((field) =>
      pkIds.has(String(field?.id)),
    );
    if (pkFields.length === 0) continue;

    const tableName = String(parentTable.name ?? "").trim().toLowerCase();
    const singularName = singularize(tableName);

    for (const pkField of pkFields) {
      const pkFieldName = String(pkField.name ?? "").trim().toLowerCase();

      const candidateNames = new Set([
        `${tableName}_${pkFieldName}`,
        `${singularName}_${pkFieldName}`,
        `${tableName}${pkFieldName}`,
        `${singularName}${pkFieldName}`,
      ]);
      if (pkFieldName !== "id") {
        candidateNames.add(pkFieldName);
      }

      for (const childTable of tables_) {
        if (String(childTable?.id) === String(parentTable.id)) continue;

        for (const fkField of childTable?.fields ?? []) {
          const fkFieldName = String(fkField?.name ?? "").trim().toLowerCase();
          if (!candidateNames.has(fkFieldName)) continue;

          if (
            isFieldAlreadyLinked(known, String(childTable.id), String(fkField.id)) ||
            isPairAlreadyLinked(
              known,
              String(childTable.id),
              String(fkField.id),
              String(parentTable.id),
              String(pkField.id),
            )
          ) {
            continue;
          }

          const candidate: Relationship = {
            id: `infer_${childTable.id}_${fkField.id}_${parentTable.id}`,
            name: `fk_${childTable.name}_${fkField.name}_${parentTable.name}`,
            startTableId: childTable.id,
            startFieldId: fkField.id,
            endTableId: parentTable.id,
            endFieldId: pkField.id,
            cardinality: fkField.unique
              ? Cardinality.ONE_TO_ONE
              : Cardinality.MANY_TO_ONE,
            updateConstraint: Constraint.NONE,
            deleteConstraint: Constraint.NONE,
          };

          candidates.push(candidate);
          known.push(candidate);
        }
      }
    }
  }

  return candidates;
}
