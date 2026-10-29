import type { Diagram } from "../models/diagram.ts";
import { keyColumns } from "../models/keys.ts";
import type { Table } from "../models/table.ts";
import type { DiagramIssue, IssueSeverity } from "./types.ts";

/**
 * The key rules of P2' (design section 3.8.3, ruling 6).
 *
 * A key is an object with a physical name and a logical name, so the rules
 * about names work on two namespaces: the physical names of constraints and
 * indices are unique across the whole schema, while their logical names are
 * unique inside their table. The rules about columns work on the columns a key
 * names, which is where a deleted field shows up.
 */
const COLUMN_SEVERITY: IssueSeverity = "error";

function issue(
  code: string,
  severity: IssueSeverity,
  message: string,
  params: Record<string, string>,
  extra: Pick<DiagramIssue, "tableId" | "fieldId" | "relationshipId"> = {},
): DiagramIssue {
  return { code, severity, message, params, ...extra };
}

function fold(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function columnIds(key: { columns?: unknown; fields?: unknown }): string[] {
  return keyColumns(key as never).map((column) => String(column.fieldId));
}

/** The tables of a diagram, skipping the holes a partial document may have. */
function tablesOf(diagram: Diagram): Table[] {
  return (diagram.tables ?? []).filter((table): table is Table => Boolean(table));
}

/**
 * Reports the problems of the keys of every table.
 *
 * The codes are the ones the design lists: two of them are about a key that
 * names something which is not there (`index.unknown_field`,
 * `constraint.no_columns`), the name codes are about the two namespaces, and
 * the last few are the hints a database administrator expects (a foreign key
 * without an index, an index without the relationship it supports).
 */
export function checkKeys(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const tables = tablesOf(diagram);
  const relationships = new Map<string, unknown>();
  for (const relationship of diagram.relationships ?? []) {
    if (relationship) relationships.set(String(relationship.id), relationship);
  }

  // The physical namespace is shared by the constraints and the indices, the
  // logical one is per table; both registries belong to this run only.
  const physical = new Map<string, string[]>();
  const logical = new Map<string, Set<string>>();
  const report = (name: string, where: string): void => {
    const folded = fold(name);
    if (!folded) return;
    const owners = physical.get(folded) ?? [];
    owners.push(where);
    physical.set(folded, owners);
  };

  for (const table of tables) {
    const tableId = String(table.id);
    const fields = new Set((table.fields ?? []).map((field) => String(field.id)));
    const tableName = table.name ?? "";

    const keys = [
      ...(table.primaryKey ? [{ kind: "primary" as const, key: table.primaryKey }] : []),
      ...(table.uniqueKeys ?? []).map((key) => ({ kind: "unique" as const, key })),
    ];

    for (const { kind, key } of keys) {
      const label = kind === "primary" ? "primary key" : "unique key";
      const columns = columnIds(key);
      const missing = columns.filter((column) => !fields.has(column));
      if (columns.length === 0 || missing.length > 0) {
        found.push(
          issue(
            "constraint.no_columns",
            COLUMN_SEVERITY,
            `The ${label} "${key.name}" of the table "${tableName}" names no column the table has.`,
            { table: tableName, constraint: String(key.name ?? "") },
            { tableId },
          ),
        );
      }
      report(String(key.name ?? ""), `${tableId}/${kind}`);
      reportLogical(found, logical, tableId, tableName, key, label);
    }

    for (const key of table.foreignKeys ?? []) {
      report(String(key.name ?? ""), `${tableId}/foreign`);
      reportLogical(found, logical, tableId, tableName, key, "foreign key");
      if (!relationships.has(String(key.relationshipId))) {
        found.push(
          issue(
            "constraint.fk_without_relationship",
            COLUMN_SEVERITY,
            `The foreign key "${key.name}" of the table "${tableName}" names a relationship that is not there.`,
            { table: tableName, constraint: String(key.name ?? ""), relationship: String(key.relationshipId ?? "") },
            { tableId, relationshipId: String(key.relationshipId ?? "") },
          ),
        );
      }
    }

    for (const index of table.indices ?? []) {
      const columns = columnIds(index);
      const missing = columns.filter((column) => !fields.has(column));
      if (missing.length > 0) {
        found.push(
          issue(
            "index.unknown_field",
            COLUMN_SEVERITY,
            `The index "${index.name}" of the table "${tableName}" names a column the table does not have.`,
            { table: tableName, index: String(index.name ?? ""), column: missing[0] ?? "" },
            { tableId },
          ),
        );
      }
      report(String(index.name ?? ""), `${tableId}/index`);
      reportLogical(found, logical, tableId, tableName, index, "index");
      if (
        index.supportsRelationshipId !== undefined &&
        !relationships.has(String(index.supportsRelationshipId))
      ) {
        found.push(
          issue(
            "index.no_supporting_relationship",
            "info",
            `The index "${index.name}" supports a relationship that is not there.`,
            { table: tableName, index: String(index.name ?? "") },
            { tableId, relationshipId: String(index.supportsRelationshipId) },
          ),
        );
      }
    }

    // Two indices over the same columns are usually one index too many.
    const seenColumns = new Map<string, string>();
    for (const index of table.indices ?? []) {
      const signature = columnIds(index).join(",");
      if (!signature) continue;
      const first = seenColumns.get(signature);
      if (first !== undefined) {
        found.push(
          issue(
            "index.duplicate_columns",
            "warning",
            `The indices "${first}" and "${index.name}" of the table "${tableName}" cover the same columns.`,
            { table: tableName, first, index: String(index.name ?? "") },
            { tableId },
          ),
        );
      } else {
        seenColumns.set(signature, String(index.name ?? ""));
      }
    }

    // A unique key that a unique index already enforces is a second mechanism.
    for (const key of table.uniqueKeys ?? []) {
      const signature = columnIds(key).join(",");
      if (!signature) continue;
      const clash = (table.indices ?? []).find(
        (index) => index.unique === true && columnIds(index).join(",") === signature,
      );
      if (clash) {
        found.push(
          issue(
            "index.unique_constraint_conflict",
            "warning",
            `The unique key "${key.name}" and the index "${clash.name}" of the table "${tableName}" cover the same columns.`,
            { table: tableName, constraint: String(key.name ?? ""), index: String(clash.name ?? "") },
            { tableId },
          ),
        );
      }
    }
  }

  for (const [name, owners] of physical) {
    if (owners.length < 2) continue;
    const kinds = owners.map((owner) => owner.split("/")[1] ?? "");
    for (const [position, owner] of owners.entries()) {
      const [tableId, kind] = owner.split("/");
      const code = kind === "index" ? "index.duplicate_schema_name" : "constraint.duplicate_schema_name";
      found.push(
        issue(
          code,
          COLUMN_SEVERITY,
          `The name "${name}" is used by ${owners.length} keys of the diagram (${kinds.join(", ")}).`,
          { name, owners: owners.join(", ") },
          { tableId: String(tableId) },
        ),
      );
      void position;
    }
  }

  // A relationship that has no foreign key object of its own (INV-10), and one
  // that no index supports: a foreign key without an index is thewrite amplification
  // a database administrator looks for.
  const supported = new Set<string>();
  const indexed = new Set<string>();
  for (const table of tables) {
    for (const key of table.foreignKeys ?? []) supported.add(String(key.relationshipId));
    for (const index of table.indices ?? []) {
      if (index.supportsRelationshipId !== undefined) indexed.add(String(index.supportsRelationshipId));
    }
  }
  for (const [id, relationship] of relationships) {
    const row = relationship as { startTableId?: unknown; name?: unknown };
    if (!indexed.has(id)) {
      found.push(
        issue(
          "index.relationship_without_index",
          "info",
          `The relationship "${String(row.name ?? id)}" has no index that supports it.`,
          { relationship: String(row.name ?? id) },
          { tableId: String(row.startTableId ?? ""), relationshipId: id },
        ),
      );
    }
    if (supported.has(id)) continue;
    found.push(
      issue(
        "constraint.relationship_without_fk",
        "info",
        `The relationship "${String(row.name ?? id)}" has no foreign key object.`,
        { relationship: String(row.name ?? id) },
        { tableId: String(row.startTableId ?? ""), relationshipId: id },
      ),
    );
  }

  return found;
}

/** Reports a logical name used twice inside one table. */
function reportLogical(
  found: DiagramIssue[],
  registry: Map<string, Set<string>>,
  tableId: string,
  tableName: string,
  key: { name?: unknown; logicalName?: unknown },
  label: string,
): void {
  const logical = fold(key.logicalName);
  if (!logical) return;
  const seen = registry.get(tableId) ?? new Set<string>();
  if (seen.has(logical)) {
    found.push(
      issue(
        "constraint.duplicate_logical_name",
        "warning",
        `The logical name "${String(key.logicalName ?? "")}" is used by more than one key of the table "${tableName}".`,
        { table: tableName, name: String(key.logicalName ?? ""), kind: label },
        { tableId },
      ),
    );
    return;
  }
  seen.add(logical);
  registry.set(tableId, seen);
}

