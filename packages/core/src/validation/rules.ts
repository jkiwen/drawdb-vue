import type { DatabaseType, Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";
import { getTypeMetadata } from "../types/registry.ts";
import { classifyDefaultKind } from "../types/registry.ts";
import type { DefaultKind } from "../types/registry.ts";
import type { DiagramIssue, IssueSeverity } from "./types.ts";

/** The value of a default that is always accepted, whatever the type is. */
const KEYWORD_DEFAULTS = new Set([
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "LOCALTIME",
  "LOCALTIMESTAMP",
  "NOW()",
  "SYSDATE",
  "SYSTIMESTAMP",
]);

/** A default that is the result of a function call, e.g. `now()`. */
function isFunctionDefault(value: unknown): boolean {
  return /\w+\([^)]*\)$/.test(String(value ?? "").trim());
}

/**
 * The kind of value a type accepts as a default.
 *
 * The dialect metadata wins when it knows the type; otherwise the kind is
 * derived from the name of the type.
 */
export function resolveDefaultKind(
  database: DatabaseType,
  type: string,
): DefaultKind {
  const meta = getTypeMetadata(database, type);
  if (meta?.defaultKind) return meta.defaultKind;
  return classifyDefaultKind(type, Boolean(meta?.noDefault));
}

/**
 * True when `value` is a legal default for a type of the given kind.
 *
 * An empty default, a function call and a keyword are always legal.
 */
export function isDefaultValid(
  kind: DefaultKind | undefined,
  value: string | number | boolean,
): boolean {
  if (!kind) return true;
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (text === "") return true;
  if (isFunctionDefault(text)) return true;
  if (KEYWORD_DEFAULTS.has(text.toUpperCase())) return true;

  switch (kind) {
    case "numeric":
      return Number.isFinite(Number(text));
    case "boolean":
      return ["true", "false", "0", "1"].includes(text.toLowerCase());
    case "date":
      return Number.isFinite(Date.parse(text));
    case "text":
    case "none":
    default:
      return true;
  }
}

/** Builds an issue. */
function issue(
  code: string,
  severity: IssueSeverity,
  message: string,
  params: Record<string, string> = {},
  ids: Partial<
    Pick<
      DiagramIssue,
      "tableId" | "fieldId" | "relationshipId" | "viewId" | "typeId" | "enumName"
    >
  > = {},
): DiagramIssue {
  return { code, severity, message, params, ...ids };
}

/** The name of a table, trimmed and lower cased, for the duplicate checks. */
function key(name: string | undefined): string {
  return String(name ?? "").trim().toLowerCase();
}

/** The tables of a diagram. */
function tablesOf(diagram: Diagram): Table[] {
  return Array.isArray(diagram?.tables) ? diagram.tables : [];
}

/** Reports the tables without a name and the duplicated table names. */
export function checkTableNames(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const seen = new Map<string, number>();

  for (const table of tablesOf(diagram)) {
    if (!key(table?.name)) {
      found.push(
        issue(
          "table.no_name",
          "error",
          "The table has no name.",
          { table: table?.name ?? "" },
          { tableId: String(table?.id) },
        ),
      );
      continue;
    }
    const name = key(table.name);
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) {
      found.push(
        issue(
          "table.duplicate_name",
          "error",
          `The name "${table.name}" is used by more than one table.`,
          { table: table.name },
          { tableId: String(table?.id) },
        ),
      );
    }
  }

  return found;
}

/** Reports the fields without a name or a type and the duplicated names. */
export function checkFields(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];

  for (const table of tablesOf(diagram)) {
    const seen = new Map<string, number>();
    for (const field of table?.fields ?? []) {
      if (!key(field?.name)) {
        found.push(
          issue(
            "field.no_name",
            "error",
            "The field has no name.",
            { table: table.name ?? "", field: field?.name ?? "" },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }
      if (!key(field?.fieldType?.type)) {
        found.push(
          issue(
            "field.no_type",
            "error",
            "The field has no type.",
            { table: table.name ?? "", field: field?.name ?? "" },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }
      if (isEnumType(field?.fieldType?.type) && (field?.values?.length ?? 0) === 0) {
        found.push(
          issue(
            "field.no_values",
            "error",
            "The enum field has no values.",
            { table: table.name ?? "", field: field?.name ?? "" },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }
      if (field?.notNull && field?.nullable) {
        found.push(
          issue(
            "field.not_null_is_null",
            "warning",
            "The field is marked as not null and as nullable.",
            { table: table.name ?? "", field: field?.name ?? "" },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }

      const name = key(field?.name);
      if (!name) continue;
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "field.duplicate_name",
            "error",
            `The name "${field.name}" is used by more than one field of the table "${table.name}".`,
            { table: table.name ?? "", field: field.name },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }
    }
  }

  return found;
}

/** True when a type is an inline enum. */
function isEnumType(type: string | undefined): boolean {
  const upper = String(type ?? "").toUpperCase();
  return upper === "ENUM" || upper === "SET";
}

/** Reports the tables that have fields but no primary key. */
export function checkPrimaryKeys(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];

  for (const table of tablesOf(diagram)) {
    const fields = table?.fields ?? [];
    if (fields.length === 0) continue;
    if (fields.some((field) => field?.primary)) continue;
    found.push(
      issue(
        "table.no_primary_key",
        "warning",
        `The table "${table.name}" has no primary key.`,
        { table: table.name ?? "" },
        { tableId: String(table?.id) },
      ),
    );
  }

  return found;
}

/** Reports the defaults that do not match the type of their field. */
export function checkDefaultValues(
  diagram: Diagram,
  database: DatabaseType,
): DiagramIssue[] {
  const found: DiagramIssue[] = [];

  for (const table of tablesOf(diagram)) {
    for (const field of table?.fields ?? []) {
      if (field?.default === undefined || field?.default === null) continue;
      const kind = resolveDefaultKind(database, field?.fieldType?.type ?? "");
      if (isDefaultValid(kind, field.default)) continue;
      found.push(
        issue(
          "field.default_mismatch",
          "error",
          `The default "${String(field.default)}" is not valid for the type "${field.fieldType?.type}".`,
          {
            table: table.name ?? "",
            field: field.name ?? "",
            type: field.fieldType?.type ?? "",
            default: String(field.default),
          },
          { tableId: String(table?.id), fieldId: String(field?.id) },
        ),
      );
    }
  }

  return found;
}

/** Reports the fields that duplicate a field of an inherited table. */
export function checkInheritedFields(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const tables = tablesOf(diagram);

  for (const table of tables) {
    const inherits = table?.inherits ?? [];
    if (!inherits.length) continue;
    const parents = tables.filter(
      (candidate) =>
        inherits.includes(String(candidate.id)) ||
        inherits.map((name) => key(name)).includes(key(candidate.name)),
    );
    for (const parent of parents) {
      const inherited = new Set(
        (parent.fields ?? []).map((field) => key(field?.name)),
      );
      for (const field of table.fields ?? []) {
        if (!inherited.has(key(field?.name))) continue;
        found.push(
          issue(
            "field.inherited_duplicate",
            "warning",
            `The field "${field.name}" is already inherited from the table "${parent.name}".`,
            { table: table.name ?? "", field: field.name ?? "" },
            { tableId: String(table?.id), fieldId: String(field?.id) },
          ),
        );
      }
    }
  }

  return found;
}

/** Reports the indices and the unique constraints of the tables. */
export function checkIndices(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];

  for (const table of tablesOf(diagram)) {
    const indices = table?.indices ?? [];
    const seen = new Map<string, number>();
    for (const index of indices) {
      if (!key(index?.name)) {
        found.push(
          issue(
            "index.no_name",
            "error",
            "The index has no name.",
            { table: table.name ?? "" },
            { tableId: String(table?.id) },
          ),
        );
      }
      if (!(index?.fields?.length > 0)) {
        found.push(
          issue(
            "index.no_fields",
            "error",
            "The index has no fields.",
            { table: table.name ?? "", index: index?.name ?? "" },
            { tableId: String(table?.id) },
          ),
        );
      }
      const name = key(index?.name);
      if (!name) continue;
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "index.duplicate_name",
            "error",
            `The name "${index.name}" is used by more than one index of the table "${table.name}".`,
            { table: table.name ?? "", index: index.name },
            { tableId: String(table?.id) },
          ),
        );
      }
    }

    const constraints = table?.uniqueConstraints ?? [];
    const seenConstraints = new Map<string, number>();
    for (const constraint of constraints) {
      if (!(constraint?.fields?.length > 0)) {
        found.push(
          issue(
            "unique_constraint.no_fields",
            "error",
            "The unique constraint has no fields.",
            { table: table.name ?? "", constraint: constraint?.name ?? "" },
            { tableId: String(table?.id) },
          ),
        );
      }
      const name = key(constraint?.name);
      if (!name) continue;
      const count = seenConstraints.get(name) ?? 0;
      seenConstraints.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "unique_constraint.duplicate_name",
            "error",
            `The name "${constraint.name}" is used by more than one unique constraint of the table "${table.name}".`,
            { table: table.name ?? "", constraint: constraint.name },
            { tableId: String(table?.id) },
          ),
        );
      }
    }
  }

  return found;
}

/** Reports the custom types and their fields. */
export function checkTypes(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const types = Array.isArray(diagram?.types) ? diagram.types : [];
  const seen = new Map<string, number>();

  for (const type of types) {
    if (!key(type?.name)) {
      found.push(
        issue(
          "type.no_name",
          "error",
          "The custom type has no name.",
          { type: type?.name ?? "" },
          { typeId: type?.id === undefined ? undefined : String(type.id) },
        ),
      );
    } else {
      const name = key(type.name);
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "type.duplicate_name",
            "error",
            `The name "${type.name}" is used by more than one custom type.`,
            { type: type.name },
            { typeId: type?.id === undefined ? undefined : String(type.id) },
          ),
        );
      }
    }

    if (!(type?.fields?.length > 0)) {
      found.push(
        issue(
          "type.no_fields",
          "error",
          `The custom type "${type?.name ?? ""}" has no fields.`,
          { type: type?.name ?? "" },
          { typeId: type?.id === undefined ? undefined : String(type.id) },
        ),
      );
    }

    const seenFields = new Map<string, number>();
    for (const field of type?.fields ?? []) {
      if (!key(field?.name)) {
        found.push(
          issue(
            "type_field.no_name",
            "error",
            "The field of the custom type has no name.",
            { type: type?.name ?? "", field: field?.name ?? "" },
            { typeId: type?.id === undefined ? undefined : String(type.id) },
          ),
        );
      }
      if (!key(field?.type)) {
        found.push(
          issue(
            "type_field.no_type",
            "error",
            "The field of the custom type has no type.",
            { type: type?.name ?? "", field: field?.name ?? "" },
            { typeId: type?.id === undefined ? undefined : String(type.id) },
          ),
        );
      }
      if (isEnumType(field?.type) && (field?.values?.length ?? 0) === 0) {
        found.push(
          issue(
            "type_field.no_values",
            "error",
            "The enum field of the custom type has no values.",
            { type: type?.name ?? "", field: field?.name ?? "" },
            { typeId: type?.id === undefined ? undefined : String(type.id) },
          ),
        );
      }
      const name = key(field?.name);
      if (!name) continue;
      const count = seenFields.get(name) ?? 0;
      seenFields.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "type_field.duplicate_name",
            "error",
            `The name "${field.name}" is used by more than one field of the custom type "${type?.name ?? ""}".`,
            { type: type?.name ?? "", field: field.name },
            { typeId: type?.id === undefined ? undefined : String(type.id) },
          ),
        );
      }
    }
  }

  return found;
}

/** Reports the enums. */
export function checkEnums(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const enums = Array.isArray(diagram?.enums) ? diagram.enums : [];
  const seen = new Map<string, number>();

  for (const entry of enums) {
    if (!key(entry?.name)) {
      found.push(
        issue(
          "enum.no_name",
          "error",
          "The enum has no name.",
          { enum: entry?.name ?? "" },
          { enumName: entry?.name },
        ),
      );
    } else {
      const name = key(entry.name);
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "enum.duplicate_name",
            "error",
            `The name "${entry.name}" is used by more than one enum.`,
            { enum: entry.name },
            { enumName: entry.name },
          ),
        );
      }
    }
    if (!(entry?.values?.length > 0)) {
      found.push(
        issue(
          "enum.no_values",
          "error",
          `The enum "${entry?.name ?? ""}" has no values.`,
          { enum: entry?.name ?? "" },
          { enumName: entry?.name },
        ),
      );
    }
  }

  return found;
}

/** Reports the views, their joins and their columns. */
export function checkViews(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const views = Array.isArray(diagram?.views) ? diagram.views : [];
  const tables = tablesOf(diagram);
  const tableNames = new Set(tables.map((table) => key(table?.name)));
  const seen = new Map<string, number>();

  for (const view of views) {
    if (!key(view?.name)) {
      found.push(
        issue(
          "view.no_name",
          "error",
          "The view has no name.",
          { view: view?.name ?? "" },
          { viewId: String(view?.id) },
        ),
      );
    } else {
      const name = key(view.name);
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "view.duplicate_name",
            "error",
            `The name "${view.name}" is used by more than one view.`,
            { view: view.name },
            { viewId: String(view?.id) },
          ),
        );
      }
      if (tableNames.has(name)) {
        found.push(
          issue(
            "view.name_clashes_table",
            "warning",
            `The name "${view.name}" is also used by a table.`,
            { view: view.name },
            { viewId: String(view?.id) },
          ),
        );
      }
    }

    const baseTableId = view?.baseTableId;
    const baseExists =
      baseTableId !== undefined &&
      baseTableId !== null &&
      tables.some((table) => table.id === baseTableId);
    if (!baseExists) {
      found.push(
        issue(
          "view.no_base_table",
          "error",
          `The view "${view?.name ?? ""}" has no base table.`,
          { view: view?.name ?? "" },
          { viewId: String(view?.id) },
        ),
      );
    }

    let previousTableId = baseTableId ?? null;
    for (const join of view?.joins ?? []) {
      const joinTable = tables.find((table) => table.id === join?.tableId);
      if (!joinTable) {
        found.push(
          issue(
            "join.no_table",
            "error",
            "The join of the view has no table.",
            { view: view?.name ?? "" },
            { viewId: String(view?.id) },
          ),
        );
      }
      if (!join?.on) {
        found.push(
          issue(
            "join.no_condition",
            "error",
            "The join of the view has no condition.",
            { view: view?.name ?? "" },
            { viewId: String(view?.id) },
          ),
        );
      } else if (
        previousTableId !== null &&
        join.on.leftTableId !== previousTableId
      ) {
        found.push(
          issue(
            "join.out_of_order",
            "warning",
            "The join of the view does not follow the table of the previous join.",
            { view: view?.name ?? "" },
            { viewId: String(view?.id) },
          ),
        );
      }
      previousTableId = joinTable ? joinTable.id : previousTableId;
    }

    const columnNames = new Map<string, number>();
    for (const column of view?.columns ?? []) {
      const owner = tables.find((table) => table.id === column?.tableId);
      const fieldExists = owner
        ? (owner.fields ?? []).some((field) => field.id === column?.fieldId)
        : false;
      if (!fieldExists) {
        found.push(
          issue(
            "view_column.no_field",
            "error",
            "The column of the view has no field.",
            { view: view?.name ?? "", column: column?.alias ?? "" },
            { viewId: String(view?.id) },
          ),
        );
      }
      const name = key(column?.alias);
      if (!name) continue;
      const count = columnNames.get(name) ?? 0;
      columnNames.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "view_column.duplicate_name",
            "error",
            `The name "${column.alias}" is used by more than one column of the view "${view?.name ?? ""}".`,
            { view: view?.name ?? "", column: column.alias ?? "" },
            { viewId: String(view?.id) },
          ),
        );
      }
    }
  }

  return found;
}

/** Reports the relationships whose endpoints are gone and the circular ones. */
export function checkRelationships(diagram: Diagram): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const tables = tablesOf(diagram);
  const relationships = Array.isArray(diagram?.relationships)
    ? diagram.relationships
    : [];
  const seen = new Map<string, number>();

  for (const relationship of relationships) {
    const start = tables.find((table) => table.id === relationship?.startTableId);
    const end = tables.find((table) => table.id === relationship?.endTableId);
    if (!start || !end) {
      found.push(
        issue(
          "relationship.missing_table",
          "error",
          "The relationship refers to a table that does not exist.",
          { relationship: relationship?.name ?? "" },
          { relationshipId: String(relationship?.id) },
        ),
      );
    } else {
      const startField = (start.fields ?? []).find(
        (field) => field.id === relationship?.startFieldId,
      );
      const endField = (end.fields ?? []).find(
        (field) => field.id === relationship?.endFieldId,
      );
      if (!startField || !endField) {
        found.push(
          issue(
            "relationship.missing_field",
            "error",
            "The relationship refers to a field that does not exist.",
            { relationship: relationship?.name ?? "" },
            { relationshipId: String(relationship?.id) },
          ),
        );
      }
    }

    if (key(relationship?.name)) {
      const name = key(relationship?.name);
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      if (count > 0) {
        found.push(
          issue(
            "relationship.duplicate_name",
            "error",
            `The name "${relationship.name}" is used by more than one relationship.`,
            { relationship: relationship.name ?? "" },
            { relationshipId: String(relationship?.id) },
          ),
        );
      }
    }
  }

  found.push(...findCircularRelationships(relationships));

  return found;
}

/**
 * Finds the relationships that close a cycle of tables.
 *
 * Every cycle is reported once, through the relationship that closes it.
 */
function findCircularRelationships(
  relationships: ReturnType<typeof Array.prototype.slice> extends never
    ? never
    : Diagram["relationships"],
): DiagramIssue[] {
  const found: DiagramIssue[] = [];
  const edges = new Map<string, string[]>();
  for (const relationship of relationships) {
    const from = String(relationship?.startTableId);
    const to = String(relationship?.endTableId);
    const list = edges.get(from) ?? [];
    list.push(to);
    edges.set(from, list);
  }

  const state = new Map<string, "open" | "done">();

  const visit = (node: string, stack: Set<string>): void => {
    state.set(node, "open");
    stack.add(node);
    for (const next of edges.get(node) ?? []) {
      if (stack.has(next)) {
        const relationship = relationships.find(
          (candidate) =>
            String(candidate?.startTableId) === node &&
            String(candidate?.endTableId) === next,
        );
        if (relationship) {
          found.push(
            issue(
              "relationship.circular",
              "warning",
              "The relationship takes part in a cycle of tables.",
              { relationship: relationship.name ?? "" },
              { relationshipId: String(relationship?.id) },
            ),
          );
        }
        continue;
      }
      if (state.get(next) === "done") continue;
      visit(next, stack);
    }
    stack.delete(node);
    state.set(node, "done");
  };

  for (const node of edges.keys()) {
    if (state.get(node) === "done") continue;
    visit(node, new Set());
  }

  return found;
}
