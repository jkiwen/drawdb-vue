import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import { getTypeMetadata } from "./dialect-meta.ts";

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

  const typeInfo = getTypeMetadata(database, field.type);
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
            .map((f) => quote(f))
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
