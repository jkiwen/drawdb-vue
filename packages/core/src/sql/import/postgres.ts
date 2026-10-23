import type { DatabaseType } from "../../models/diagram.ts";
import { Cardinality, Constraint } from "../../models/constants.ts";
import type { Enum } from "../../models/enum.ts";
import type { Field } from "../../models/field.ts";
import type {
  Relationship,
  RelationshipFieldPair,
} from "../../models/relationship.ts";
import type { Table } from "../../models/table.ts";
import type { CustomType, TypeField } from "../../models/type.ts";
import { canonicalTypeName } from "../../types/registry.ts";
import { createId } from "../../utils/id.ts";
import type { ASTNode } from "./shared.ts";
import {
  capitalize,
  findFieldByName,
  findReferencedTable,
  quoteColumn,
  readDefaultValue,
} from "./shared.ts";

/**
 * A field of a PostgreSQL composite type.
 *
 * The SDK type model has no `size` for type fields, the React importer kept it.
 */
export interface PostgresTypeField extends TypeField {
  size?: string | number;
}

/** A PostgreSQL composite type, compatible with the SDK `CustomType` model. */
export interface PostgresCustomType extends Omit<CustomType, "fields"> {
  fields: PostgresTypeField[];
}

/**
 * Result of a PostgreSQL import.
 *
 * `tables` and `relationships` are the diagram fragment, `enums` and `types`
 * carry the user defined PostgreSQL types (ported from the React importer,
 * which returned them as well).
 */
export interface PostgresImportFragment {
  tables: Table[];
  relationships: Relationship[];
  enums: Enum[];
  types: PostgresCustomType[];
}

const POSTGRES_TABLE_COLOR = "#175e7a";

/** A foreign key that still has to be linked to its tables and fields. */
interface PendingForeignKey {
  startTableName: string;
  startFieldNames: string[];
  endTableName: string;
  endFieldNames: string[];
  onAction: ASTNode[];
}

/** A column whose declared type may still be a user defined type. */
interface PendingColumnType {
  field: Field;
  dataType: string;
}

/**
 * Convert a PostgreSQL AST into tables and relationships.
 *
 * Mirrors the behaviour of the React drawDB PostgreSQL importer, but works on
 * the SDK data model, uses the shared type registry for type canonicalisation
 * and resolves foreign keys / user defined types after every statement has
 * been read (so forward references work).
 */
export function fromPostgres(
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType = "postgres",
): PostgresImportFragment {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  const enums: Enum[] = [];
  const types: PostgresCustomType[] = [];
  const pendingForeignKeys: PendingForeignKey[] = [];
  const pendingColumnTypes: PendingColumnType[] = [];

  const parseSingleStatement = (statement: ASTNode) => {
    if (statement.type === "create") {
      if (statement.keyword === "table") {
        const table: Table = {
          id: createId(),
          name: statement.table[0].table,
          x: 0,
          y: 0,
          comment: "",
          color: POSTGRES_TABLE_COLOR,
          fields: [],
          indices: [],
          uniqueConstraints: [],
        };

        (statement.create_definitions ?? []).forEach((definition: ASTNode) => {
          if (definition.resource === "column") {
            const field = parseColumn(definition, diagramDb);
            pendingColumnTypes.push({
              field,
              dataType: String(definition.definition?.dataType ?? ""),
            });
            table.fields.push(field);

            if (definition.reference_definition) {
              pendingForeignKeys.push(
                readForeignKey(table.name, definition.reference_definition, [
                  field.name,
                ]),
              );
            }
          } else if (definition.resource === "constraint") {
            applyConstraint(definition, table, pendingForeignKeys);
          }
        });

        tables.push(table);
      } else if (statement.keyword === "index") {
        const index = {
          name: statement.index,
          unique: statement.index_type === "unique",
          fields: (statement.index_columns ?? []).map((column: ASTNode) =>
            readColumnRefName(column),
          ),
        };

        const table = tables.find((t) => t.name === statement.table?.table);
        if (table) {
          table.indices = table.indices ?? [];
          table.indices.push(index);
          table.indices.forEach((entry, indexPosition) => {
            entry.id = indexPosition;
          });
        }
      } else if (statement.keyword === "type") {
        if (statement.resource === "enum") {
          const values = (statement.create_definitions?.value ?? []).map(
            (value: ASTNode) => value.value,
          );
          enums.push({ name: statement.name?.name, values, id: createId() });
        } else if (Array.isArray(statement.create_definitions)) {
          const fields: PostgresTypeField[] = [];
          statement.create_definitions.forEach((definition: ASTNode) => {
            if (definition.resource !== "column") return;

            const field: PostgresTypeField = {
              name: readColumnRefName(definition.column),
              type: canonicalTypeName(
                diagramDb,
                String(definition.definition?.dataType ?? ""),
              ),
            };

            const length = definition.definition?.["length"];
            if (length !== undefined && length !== null) {
              field.size = definition.definition?.scale
                ? `${length},${definition.definition.scale}`
                : length;
            }

            fields.push(field);
          });

          types.push({ name: statement.name?.name, fields, id: createId() });
        }
      }
    } else if (statement.type === "alter") {
      (statement.expr ?? []).forEach((expression: ASTNode) => {
        const definition = expression.create_definitions;
        if (
          expression.action === "add" &&
          String(definition?.constraint_type ?? "").toLowerCase() ===
            "foreign key"
        ) {
          const startTableName =
            statement.table?.[0]?.table ?? expression.table?.[0]?.table;
          if (!startTableName || !definition.reference_definition) return;

          pendingForeignKeys.push(
            readForeignKey(
              startTableName,
              definition.reference_definition,
              (definition.definition ?? []).map((column: ASTNode) =>
                readColumnRefName(column),
              ),
            ),
          );
        }
      });
    } else if (statement.type === "comment") {
      if (statement.target?.type === "table") {
        const table = tables.find((t) => t.name === statement.target?.name?.table);
        if (table) {
          table.comment = String(statement.expr?.expr?.value ?? "");
        }
      } else if (statement.target?.type === "column") {
        const table = tables.find((t) => t.name === statement.target?.name?.table);
        if (table) {
          const fieldName = statement.target?.name?.column?.expr?.value;
          const field = table.fields.find((f) => f.name === fieldName);
          if (field) {
            field.comment = String(statement.expr?.expr?.value ?? "");
          }
        }
      }
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach(parseSingleStatement);
  } else {
    parseSingleStatement(ast);
  }

  // User defined types may be declared after the tables that use them.
  pendingColumnTypes.forEach((pending) => {
    pending.field.type = resolveColumnType(
      pending.dataType,
      diagramDb,
      types,
      enums,
    );
  });

  // Foreign keys may point at tables that are declared later in the script.
  pendingForeignKeys.forEach((pending) => {
    const relationship = buildRelationship(pending, tables);
    if (relationship) relationships.push(relationship);
  });

  return { tables, relationships, enums, types };
}

/**
 * Rebuild a SQL expression of the PostgreSQL grammar.
 *
 * The shared helper only knows the MySQL shape where a column reference is a
 * plain string, PostgreSQL nests the name in `column.expr.value`.
 */
function buildPostgresExpression(node: ASTNode | undefined): string {
  if (!node) return "";

  if (node.type === "binary_expr") {
    return `${buildPostgresExpression(node.left)} ${node.operator} ${buildPostgresExpression(node.right)}`;
  }

  if (node.type === "column_ref") {
    return quoteColumn(readColumnRefName(node), "postgres");
  }

  if (node.type === "function") {
    const nameNode = node.name;
    const name = Array.isArray(nameNode?.name)
      ? nameNode.name[0]?.value ?? ""
      : nameNode?.name ?? nameNode?.value ?? "";
    if (!node.args) return String(name);
    const args = (node.args.value ?? [])
      .map((arg: ASTNode) => buildPostgresExpression(arg))
      .join(", ");
    return `${name}(${args})`;
  }

  if (node.type === "expr_list") {
    return (node.value ?? [])
      .map((value: ASTNode) => buildPostgresExpression(value))
      .join(" AND ");
  }

  if (
    node.type === "single_quote_string" ||
    node.type === "double_quote_string"
  ) {
    return `'${node.value}'`;
  }

  if (node.type === "null") return "NULL";

  if (node.value !== undefined && node.value !== null) {
    return String(node.value);
  }

  return "";
}

/**
 * Read the default value of a column.
 *
 * The shared helper covers functions, `NULL` and literals, PostgreSQL adds
 * casts and array literals on top of that.
 */
function readPostgresDefault(node: ASTNode): string {
  const value = node?.value;
  if (value?.type === "cast") {
    return String(value.expr?.value ?? "");
  }
  if (value?.type === "array") {
    const items = (value.expr_list?.value ?? [])
      .map((item: ASTNode) => item.value ?? item.expr?.value)
      .join(", ");
    return `ARRAY[${items}]`;
  }
  return readDefaultValue(node);
}

/**
 * Read the name of a `column_ref` node.
 *
 * The PostgreSQL grammar nests the name in `column.expr.value`, the MySQL
 * grammar uses a plain string.
 */
function readColumnRefName(node: ASTNode | undefined): string {
  const column = node?.column;
  if (typeof column === "string") return column;
  if (column && typeof column === "object") {
    if (typeof column.expr?.value === "string") return column.expr.value;
    if (typeof column.value === "string") return column.value;
  }
  if (typeof node?.expr?.value === "string") return node.expr.value;
  return "";
}

function parseColumn(definition: ASTNode, diagramDb: DatabaseType): Field {
  const field: Field = {
    id: createId(),
    name: readColumnRefName(definition.column),
    type: canonicalTypeName(diagramDb, String(definition.definition?.dataType ?? "")),
    comment: definition.comment ? definition.comment.value.value : "",
    unique: Boolean(definition.unique),
    increment: Boolean(definition.auto_increment),
    notNull: Boolean(definition.nullable),
    primary: Boolean(definition.primary_key),
    default: "",
  };

  if (definition.definition?.expr?.type === "expr_list") {
    field.values = definition.definition.expr.value.map(
      (value: ASTNode) => value.value,
    );
  }

  if (definition.default_val) {
    field.default = readPostgresDefault(definition.default_val);
  }

  const length = definition.definition?.["length"];
  if (length !== undefined && length !== null) {
    field.size = definition.definition?.scale
      ? `${length},${definition.definition.scale}`
      : length;
  }

  field.check = definition.check
    ? buildPostgresExpression(definition.check.definition[0])
    : "";

  return field;
}

/**
 * Resolve the type of a column, preferring user defined types and enums over
 * the built in type registry.
 */
function resolveColumnType(
  dataType: string,
  diagramDb: DatabaseType,
  types: PostgresCustomType[],
  enums: Enum[],
): string {
  const custom = types.find((type) => matchesTypeName(dataType, type.name));
  if (custom) return custom.name;

  const enumType = enums.find((value) => matchesTypeName(dataType, value.name));
  if (enumType) return enumType.name;

  return canonicalTypeName(diagramDb, dataType);
}

function matchesTypeName(dataType: string, name: string | undefined): boolean {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(${escaped}|"${escaped}")$`).test(dataType);
}

function applyConstraint(
  definition: ASTNode,
  table: Table,
  pendingForeignKeys: PendingForeignKey[],
) {
  const constraintType = String(definition.constraint_type ?? "").toLowerCase();

  if (constraintType === "primary key") {
    (definition.definition ?? []).forEach((column: ASTNode) => {
      const columnName = readColumnRefName(column);
      table.fields.forEach((field) => {
        if (field.name === columnName && !field.primary) {
          field.primary = true;
        }
      });
    });
    return;
  }

  if (constraintType === "foreign key") {
    if (!definition.reference_definition) return;
    pendingForeignKeys.push(
      readForeignKey(
        table.name,
        definition.reference_definition,
        (definition.definition ?? []).map((column: ASTNode) =>
          readColumnRefName(column),
        ),
      ),
    );
    return;
  }

  if (constraintType.includes("unique")) {
    const fields = (definition.definition ?? []).map((column: ASTNode) =>
      readColumnRefName(column),
    );
    const name =
      definition.constraint ||
      definition.index ||
      `${table.name}_unique_${(table.uniqueConstraints ?? []).length}`;
    table.uniqueConstraints = table.uniqueConstraints ?? [];
    table.uniqueConstraints.push({ name, fields });
    table.uniqueConstraints.forEach((constraint, index) => {
      constraint.id = index;
    });
  }
}

/** Collect the parts of a foreign key that are needed to build a relationship. */
function readForeignKey(
  startTableName: string,
  referenceDefinition: ASTNode,
  startFieldNames: string[],
): PendingForeignKey {
  return {
    startTableName,
    startFieldNames,
    endTableName: referenceDefinition?.table?.[0]?.table ?? "",
    endFieldNames: (referenceDefinition?.definition ?? []).map(
      (column: ASTNode) => readColumnRefName(column),
    ),
    onAction: referenceDefinition?.on_action ?? [],
  };
}

/**
 * Build a relationship from a collected foreign key.
 *
 * The start table owns the foreign key columns, the end table is referenced.
 * Self references resolve to the start table itself.
 */
function buildRelationship(
  pending: PendingForeignKey,
  tables: Table[],
): Relationship | undefined {
  const startTable = tables.find(
    (table) => table.name === pending.startTableName,
  );
  if (!startTable) return undefined;
  if (pending.startFieldNames.length === 0) return undefined;

  const endTable = findReferencedTable(
    tables,
    startTable,
    pending.endTableName,
  );
  if (!endTable) return undefined;

  const fieldPairs: RelationshipFieldPair[] = [];
  for (let i = 0; i < pending.startFieldNames.length; i++) {
    const startField = findFieldByName(
      startTable.fields,
      pending.startFieldNames[i],
    );
    const endField = findFieldByName(endTable.fields, pending.endFieldNames[i]);
    if (!startField || !endField) break;
    fieldPairs.push({ startFieldId: startField.id, endFieldId: endField.id });
  }
  if (fieldPairs.length !== pending.startFieldNames.length) return undefined;

  const startFieldName = pending.startFieldNames[0];
  const startField = findFieldByName(startTable.fields, startFieldName);

  let updateConstraint: string = Constraint.NONE;
  let deleteConstraint: string = Constraint.NONE;
  pending.onAction.forEach((action: ASTNode) => {
    if (action.type === "on update") {
      updateConstraint = capitalize(String(action.value?.value ?? ""));
    } else if (action.type === "on delete") {
      deleteConstraint = capitalize(String(action.value?.value ?? ""));
    }
  });

  return {
    id: createId(),
    name: `fk_${startTable.name}_${startFieldName}_${endTable.name}`,
    startTableId: startTable.id,
    endTableId: endTable.id,
    startFieldId: fieldPairs[0].startFieldId,
    endFieldId: fieldPairs[0].endFieldId,
    fields: fieldPairs,
    updateConstraint,
    deleteConstraint,
    cardinality: startField?.unique
      ? Cardinality.ONE_TO_ONE
      : Cardinality.MANY_TO_ONE,
  };
}
