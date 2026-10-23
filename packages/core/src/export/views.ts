import type { Diagram } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import type { Table } from "../models/table.ts";
import type { View, ViewCondition, ViewJoin } from "../models/view.ts";
import { getRelationshipFields } from "./shared.ts";

export type QuoteFn = (s: string) => string;

export interface DialectViewFlags {
  orReplace?: boolean;
  ifNotExists?: boolean;
  orAlter?: boolean;
  materialized?: boolean;
  commentOn?: boolean;
  batchSeparator?: string;
}

const defaultQuote: QuoteFn = (s) => `"${s}"`;

const dialectQuotes: Record<string, QuoteFn> = {
  mysql: (s) => `\`${s}\``,
  mariadb: (s) => `\`${s}\``,
  mssql: (s) => `[${s}]`,
};

export function identifierQuote(database: string): QuoteFn {
  return dialectQuotes[database] ?? defaultQuote;
}

const viewDialects: Record<string, DialectViewFlags> = {
  mysql: { orReplace: true },
  mariadb: { orReplace: true },
  postgres: { orReplace: true, materialized: true, commentOn: true },
  sqlite: { ifNotExists: true },
  mssql: { orAlter: true, batchSeparator: "\nGO" },
  oraclesql: { orReplace: true, materialized: true },
  generic: { orReplace: true },
};

function lookup(
  tables: Table[],
  tableId: string | number | null | undefined,
  fieldId: string | number | null | undefined,
): { table: Table; field: Field } | null {
  if (tableId == null || fieldId == null) return null;
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;
  const field = table.fields.find((f) => f.id === fieldId);
  if (!field) return null;
  return { table, field };
}

function viewTableIds(view: View): Array<View["id"]> {
  return [view.baseTableId, ...(view.joins ?? []).map((j) => j.tableId)].filter(
    (id): id is View["id"] => id != null,
  );
}

function viewScopeTables(view: View, tables: Table[]): Table[] {
  const byId = new Map(tables.map((t) => [t.id, t]));
  return viewTableIds(view)
    .map((id) => byId.get(id))
    .filter((t): t is Table => t != null);
}

function conditionValue(value: unknown, field: Field, database: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "''";
  if (raw.startsWith("(") && raw.endsWith(")")) return raw;
  if (/\w+\([^)]*\)$/.test(raw)) return raw;
  return `'${raw.replace(/'/g, "''")}'`;
}

export function buildViewSQL(
  view: View,
  tables: Table[] = [],
  database = "generic",
): string {
  if (!view.baseTableId) return "";

  const quote = identifierQuote(database);
  const baseTable = tables.find((t) => t.id === view.baseTableId);
  if (!baseTable) return "";

  const qualify = (
    tableId: string | number | null | undefined,
    fieldId: string | number | null | undefined,
  ): string | null => {
    const resolved = lookup(tables, tableId, fieldId);
    if (!resolved) return null;
    return `${quote(resolved.table.name)}.${quote(resolved.field.name)}`;
  };

  const selectList = (view.columns ?? [])
    .map((column) => {
      const qualified = qualify(column.tableId, column.fieldId);
      if (!qualified) return null;
      return column.alias?.trim()
        ? `${qualified} AS ${quote(column.alias.trim())}`
        : qualified;
    })
    .filter((c): c is string => c != null);

  const lines = [
    selectList.length
      ? `SELECT\n${selectList.map((c) => `  ${c}`).join(",\n")}`
      : "SELECT *",
    `FROM ${quote(baseTable.name)}`,
  ];

  for (const join of view.joins ?? []) {
    const joinTable = tables.find((t) => t.id === join.tableId);
    if (!joinTable) continue;

    const left = join.on
      ? qualify(join.on.leftTableId, join.on.leftFieldId)
      : null;
    const right = join.on
      ? qualify(join.tableId, join.on.rightFieldId)
      : null;
    const onClause = left && right ? ` ON ${left} = ${right}` : "";
    lines.push(`${join.type} JOIN ${quote(joinTable.name)}${onClause}`);
  }

  const conditions = (view.conditions ?? [])
    .map((condition, index) => {
      const resolved = lookup(tables, condition.tableId, condition.fieldId);
      if (!resolved) return null;
      const qualified = `${quote(resolved.table.name)}.${quote(resolved.field.name)}`;
      const clause = condition.operator
        ? `${qualified} ${condition.operator} ${conditionValue(condition.value, resolved.field, database)}`
        : `${qualified}`;
      return index === 0 ? clause : `${condition.connector ?? "AND"} ${clause}`;
    })
    .filter((c): c is string => c != null);

  if (conditions.length) {
    lines.push(`WHERE ${conditions.join("\n  ")}`);
  }

  return lines.join("\n");
}

function viewStatement(
  view: View,
  body: string,
  dialect: DialectViewFlags,
  quote: QuoteFn,
): string {
  const materialized = view.materialized && dialect.materialized;
  const keyword = materialized ? "MATERIALIZED VIEW" : "VIEW";
  const prefix = materialized
    ? "CREATE"
    : dialect.orAlter
      ? "CREATE OR ALTER"
      : dialect.orReplace
        ? "CREATE OR REPLACE"
        : "CREATE";
  const existsClause =
    !materialized && dialect.ifNotExists ? " IF NOT EXISTS" : "";
  const name = quote(view.name);

  const statements: string[] = [];
  if (view.comment?.trim() && !dialect.commentOn) {
    statements.push(`/* ${view.comment} */`);
  }
  statements.push(`${prefix} ${keyword}${existsClause} ${name} AS\n${body};`);
  if (view.comment?.trim() && dialect.commentOn) {
    statements.push(
      `COMMENT ON ${keyword} ${name} IS '${view.comment.replace(/'/g, "''")}';`,
    );
  }

  return statements.join("\n") + (dialect.batchSeparator ?? "");
}

function viewStatements(views: View[], tables: Table[], database: string): string {
  const dialect = viewDialects[database] ?? viewDialects.generic;
  const quote = identifierQuote(database);

  return views
    .filter((v) => v.name?.trim())
    .map((view) => {
      const body = buildViewSQL(view, tables, database);
      return body ? viewStatement(view, body, dialect, quote) : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function appendViews(sql: string, diagram: Diagram): string {
  const views = viewStatements(diagram.views ?? [], diagram.tables, diagram.database);
  if (!views) return sql;

  return sql.trimEnd() ? `${sql.trimEnd()}\n\n${views}` : views;
}
