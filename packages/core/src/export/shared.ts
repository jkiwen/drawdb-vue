import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { PhysicalSpec } from "../models/physical.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import type { Index } from "../models/keys.ts";
import { keyColumns } from "../models/keys.ts";
import { getTypeMetadata } from "./dialect-meta.ts";

/**
 * Render the size/precision suffix of a physical type, e.g. `(255)` or
 * `(10,2)`. Prefers `length`, then `precision`/`scale`. Empty when the
 * spec carries no size at all.
 */
export function fieldSizeSuffix(spec: PhysicalSpec): string {
  if (spec.length !== undefined && spec.length !== null) {
    return `(${spec.length})`;
  }
  if (spec.precision !== undefined && spec.precision !== null) {
    return spec.scale !== undefined && spec.scale !== null
      ? `(${spec.precision},${spec.scale})`
      : `(${spec.precision})`;
  }
  return "";
}

export interface FkColumnNames {
  startColumns: (string | undefined)[];
  endColumns: (string | undefined)[];
}

export function getRelationshipFields(
  relationship: Relationship,
): Array<{ startFieldId: Relationship["startFieldId"]; endFieldId: Relationship["endFieldId"] }> {
  if (Array.isArray(relationship.fields) && relationship.fields.length > 0) {
    return relationship.fields;
  }
  return [
    {
      startFieldId: relationship.startFieldId,
      endFieldId: relationship.endFieldId,
    },
  ];
}

export function getFkColumnNames(
  relationship: Relationship,
  startTable: Table | { fields: Table["fields"] },
  endTable: Table | { fields: Table["fields"] } | undefined,
): FkColumnNames {
  const pairs = getRelationshipFields(relationship);
  const startColumns = pairs.map(
    (p) => startTable.fields.find((f) => f.id === p.startFieldId)?.name,
  );
  const endColumns = pairs.map(
    (p) => endTable?.fields.find((f) => f.id === p.endFieldId)?.name,
  );
  return { startColumns, endColumns };
}

const SQL_KEYWORDS = new Set([
  "NULL",
  "TRUE",
  "FALSE",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "LOCALTIME",
  "LOCALTIMESTAMP",
  "SYSDATE",
  "SYSTIMESTAMP",
]);

export function isKeyword(str: string): boolean {
  if (typeof str !== "string") return false;
  return SQL_KEYWORDS.has(str.toUpperCase());
}

export function isFunction(str: string): boolean {
  return /\w+\([^)]*\)$/.test(str);
}

export function escapeQuotes(str: string): string {
  return str.replace(/[']/g, "'$&");
}

export function parseDefault(
  field: Field,
  database: string,
): string | number | boolean | undefined {
  if (typeof field.default !== "string") {
    return field.default;
  }

  const typeInfo = getTypeMetadata(database, field.fieldType.type);
  if (
    isFunction(field.default) ||
    isKeyword(field.default) ||
    (typeInfo && !typeInfo.hasQuotes)
  ) {
    return field.default;
  }

  return `'${escapeQuotes(field.default)}'`;
}

export function exportFieldComment(comment: string): string {
  if (comment === "") {
    return "";
  }

  return comment
    .split("\n")
    .map((commentLine) => `\t-- ${commentLine}\n`)
    .join("");
}

/**
 * Comment line carrying the logical attribute name when it diverges from the
 * physical field name (spec Q7). Empty when there is no pairing or the names
 * are identical, so existing diagrams keep byte-identical output.
 */
export function exportLogicalNameComment(table: Table, field: Field): string {
  const attribute = table.logical?.attributes?.find(
    (a) => a.fieldId === field.id,
  );
  if (!attribute || attribute.name === field.name) {
    return "";
  }
  return `\t-- ${attribute.name}\n`;
}

/**
 * The columns of an index, in index order, quoted for the dialect. A
 * column that names a direction carries it; a reader that dropped it would
 * export an index the database builds in the wrong order.
 */
export function indexColumnList(
  table: Table,
  index: Index,
  quote: (s: string) => string,
): string {
  return keyColumns(index)
    .map((column) => {
      const name =
        table.fields.find((field) => String(field.id) === String(column.fieldId))
          ?.name ?? String(column.fieldId);
      const quoted = quote(name);
      return column.order ? `${quoted} ${column.order.toUpperCase()}` : quoted;
    })
    .join(", ");
}

export function uniqueConstraintClause(
  table: Table,
  quote: (s: string) => string,
): string {
  const constraints = (table.uniqueConstraints || []).filter(
    (uc) => Array.isArray(uc.fields) && uc.fields.length > 0,
  );
  if (constraints.length === 0) return "";

  return (
    ",\n" +
    constraints
      .map(
        (uc) =>
          `\tCONSTRAINT ${quote(uc.name)} UNIQUE (${uc.fields
            .map((id) =>
              quote(table.fields.find((f) => f.id === id)?.name ?? String(id)),
            )
            .join(", ")})`,
      )
      .join(",\n")
  );
}

export function getInlineFK(
  table: Table,
  diagram: Diagram,
  quote: (s: string) => string,
): string {
  const fks: string[] = [];
  for (const r of diagram.relationships) {
    if (r.startTableId === table.id) {
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      if (!endTable) continue;
      const { startColumns, endColumns } = getFkColumnNames(r, table, endTable);
      fks.push(
        `\tFOREIGN KEY (${startColumns
          .map((c) => quote(String(c)))
          .join(", ")}) REFERENCES ${quote(endTable.name)}(${endColumns
          .map((c) => quote(String(c)))
          .join(", ")})\n\tON UPDATE ${r.updateConstraint?.toUpperCase() ?? "NO ACTION"} ON DELETE ${r.deleteConstraint?.toUpperCase() ?? "NO ACTION"}`,
      );
    }
  }
  return fks.join(",\n");
}
