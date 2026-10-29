import { indexFields, keyColumns } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import type { OutlineNode, OutlineViewLayer } from "./outline-nodes.ts";
import { matchesNode } from "./outline-nodes.ts";
import { relationshipLabels } from "./outline-labels.ts";

/**
 * The keys of a table, as the outline shows them (issue 8): the primary key,
 * the unique keys, the foreign keys and the indexes, each under the name it
 * carries. A key is a leaf — its columns are shown in the tooltip and edited
 * in the panel, not in the tree. The groups that hold them are assembled by
 * `buildTableNode`, so this module only decides what a key is called.
 */
export interface TableKeyNodes {
  primary: OutlineNode[];
  unique: OutlineNode[];
  foreign: OutlineNode[];
  indexes: OutlineNode[];
}

export function keyNodes(
  table: Table,
  diagram: Diagram,
  viewLayer: OutlineViewLayer,
  query: string,
  keepAll = false,
): TableKeyNodes {
  const fieldNames = (ids: readonly (string | number)[]): string =>
    ids
      .map(
        (id) =>
          table.fields.find((field) => String(field.id) === String(id))?.name ??
          String(id),
      )
      .join(", ");
  const key = (
    kind: string,
    refId: string,
    label: string,
    altLabel: string,
  ): OutlineNode | undefined => {
    const hit = matchesNode(label, altLabel, query);
    // A table whose own name matched keeps all of its keys, the way it keeps
    // all of its fields.
    if (!keepAll && query !== "" && !hit) return undefined;
    return {
      id: `constraint:${table.id}:${kind}`,
      kind: "constraint",
      label,
      altLabel,
      category: "tables",
      refId,
      parentRefId: table.id,
      matched: hit,
      children: [],
    };
  };

  const primaryKey = table.primaryKey;
  const primaryIds =
    primaryKey === undefined
      ? table.fields.filter((field) => field.primary === true).map((field) => field.id)
      : keyColumns(primaryKey).map((column) => column.fieldId);
  const primaryName = primaryKey?.name ?? "PRIMARY";
  const primaryNodes =
    primaryIds.length > 0
      ? [
          key(
            "primary",
            "primary",
            `PK ${primaryName}`,
            `${primaryName} (${fieldNames(primaryIds)})`,
          ),
        ].filter((node): node is OutlineNode => node !== undefined)
      : [];

  const uniqueNodes: OutlineNode[] = [];
  for (const [index, constraint] of (table.uniqueKeys ?? []).entries()) {
    const ids = keyColumns(constraint).map((column) => column.fieldId);
    if (ids.length === 0) continue;
    const node = key(
      `unique:${String(constraint.id ?? index)}`,
      String(constraint.id ?? index),
      `UK ${constraint.name}`,
      `${constraint.name} (${fieldNames(ids)})`,
    );
    if (node) uniqueNodes.push(node);
  }
  const legacyUnique = table.uniqueKeys === undefined ? table.uniqueConstraints ?? [] : [];
  for (const [index, constraint] of legacyUnique.entries()) {
    const refId = String(constraint.id ?? `uk${index}`);
    const node = key(
      `unique:${refId}`,
      refId,
      `UK ${constraint.name}`,
      `${constraint.name} (${fieldNames(constraint.fields)})`,
    );
    if (node) uniqueNodes.push(node);
  }

  const foreignNodes: OutlineNode[] = [];
  for (const foreignKey of table.foreignKeys ?? []) {
    const node = key(
      `foreign:${foreignKey.relationshipId}`,
      String(foreignKey.relationshipId),
      `FK ${foreignKey.name}`,
      foreignKey.name,
    );
    if (node) foreignNodes.push(node);
  }
  for (const relationship of table.foreignKeys === undefined ? diagram.relationships : []) {
    if (String(relationship.startTableId) !== String(table.id)) continue;
    const logical = diagram.logicalRelationships?.find(
      (item) => String(item.id) === String(relationship.id),
    );
    const names = relationshipLabels(relationship, logical, diagram, viewLayer);
    const node = key(
      `foreign:${relationship.id}`,
      String(relationship.id),
      `FK ${names.label}`,
      names.altLabel ?? names.label,
    );
    if (node) foreignNodes.push(node);
  }

  const indexNodes: OutlineNode[] = [];
  for (const [index, item] of (table.indices ?? []).entries()) {
    const refId = String(item.id ?? `idx${index}`);
    const node = key(
      `index:${refId}`,
      refId,
      `INDEX ${item.name}`,
      `${item.name} (${fieldNames(indexFields(item))})`,
    );
    if (node) indexNodes.push(node);
  }

  return { primary: primaryNodes, unique: uniqueNodes, foreign: foreignNodes, indexes: indexNodes };
}
