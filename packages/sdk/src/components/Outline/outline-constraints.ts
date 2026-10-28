import type { Diagram, Table } from "@drawdb/core";
import type { OutlineNode, OutlineViewLayer } from "./outline-nodes.ts";
import { matchesNode } from "./outline-nodes.ts";
import { relationshipLabels } from "./outline-labels.ts";

/**
 * The keys of a table, as the outline shows them (issue 8): the primary key
 * under the SQL name it has, then the unique keys and the foreign keys under
 * the names they carry. A key is a leaf — its columns are shown in the tooltip
 * and edited in the panel, not in the tree.
 */
export function constraintNodes(
  table: Table,
  diagram: Diagram,
  viewLayer: OutlineViewLayer,
  query: string,
): OutlineNode[] {
  const fieldNames = (ids: readonly (string | number)[]): string =>
    ids
      .map(
        (id) =>
          table.fields.find((field) => String(field.id) === String(id))?.name ??
          String(id),
      )
      .join(", ");
  const nodes: OutlineNode[] = [];
  const push = (kind: string, refId: string, label: string, altLabel: string) => {
    const hit = matchesNode(label, altLabel, query);
    if (query !== "" && !hit) return;
    nodes.push({
      id: `constraint:${table.id}:${kind}`,
      kind: "constraint",
      label,
      altLabel,
      category: "tables",
      refId,
      parentRefId: table.id,
      matched: hit,
      children: [],
    });
  };

  const primary = table.fields.filter((field) => field.primary === true);
  if (primary.length > 0) {
    push(
      "primary",
      "primary",
      "PK PRIMARY",
      `PRIMARY (${fieldNames(primary.map((field) => field.id))})`,
    );
  }
  for (const [index, key] of (table.uniqueConstraints ?? []).entries()) {
    const refId = String(key.id ?? `uk${index}`);
    push(
      `unique:${refId}`,
      refId,
      `UK ${key.name}`,
      `${key.name} (${fieldNames(key.fields)})`,
    );
  }
  for (const relationship of diagram.relationships) {
    if (String(relationship.startTableId) !== String(table.id)) continue;
    const logical = diagram.logicalRelationships?.find(
      (item) => String(item.id) === String(relationship.id),
    );
    const names = relationshipLabels(relationship, logical, diagram, viewLayer);
    push(
      `foreign:${relationship.id}`,
      String(relationship.id),
      `FK ${names.label}`,
      names.altLabel ?? names.label,
    );
  }
  return nodes;
}
