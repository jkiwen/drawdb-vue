import type { DatabaseType } from "../../models/diagram.ts";
import { Cardinality } from "../../models/constants.ts";
import type { Field } from "../../models/field.ts";
import type {
  Relationship,
  RelationshipFieldPair,
} from "../../models/relationship.ts";
import type { Table } from "../../models/table.ts";
import { canonicalTypeName } from "../../types/registry.ts";
import { createId } from "../../utils/id.ts";
import type { ASTNode, ImportedDiagramFragment } from "./shared.ts";
import {
  buildSQLFromAST,
  capitalize,
  findFieldByName,
  findReferencedTable,
  readDefaultValue,
} from "./shared.ts";

const SQLITE_TABLE_COLOR = "#175e7a";

/**
 * Convert a SQLite AST into tables and relationships.
 *
 * Mirrors the behaviour of the React drawDB SQLite importer, but works on the
 * SDK data model and uses the shared type registry for type canonicalisation.
 */
export function fromSQLite(
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType = "sqlite",
): ImportedDiagramFragment {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];

  const parseSingleStatement = (statement: ASTNode) => {
    if (statement.type === "create") {
      if (statement.keyword === "table") {
        const table: Table = {
          id: createId(),
          name: statement.table[0].table,
          logical: {
            id: createId(),
            name: statement.table[0].table,
            attributes: [],
          },
          x: 0,
          y: 0,
          comment: "",
          color: SQLITE_TABLE_COLOR,
          fields: [],
          indices: [],
          uniqueConstraints: [],
        };

        (statement.create_definitions ?? []).forEach((definition: ASTNode) => {
          if (definition.resource === "column") {
            const field = parseColumn(definition, diagramDb);
            table.fields.push(field);

            // Inline column level foreign key: `col INTEGER REFERENCES t(id)`.
            if (definition.reference_definition) {
              const relationship = buildRelationship(
                table,
                [field.name],
                definition.reference_definition,
                tables,
              );
              if (relationship) relationships.push(relationship);
            }
          } else if (definition.resource === "constraint") {
            applyConstraint(definition, table, tables, relationships);
          }
        });

        tables.push(table);
      } else if (statement.keyword === "index") {
        const table = tables.find((t) => t.name === statement.table.table);
        if (table) {
          const index = {
            name: readIndexName(statement.index),
            unique: statement.index_type === "unique",
            fields: (statement.index_columns ?? []).map(
              (column: ASTNode) =>
                table.fields.find((f) => f.name === column.column)?.id ??
                column.column,
            ),
          };

          table.indices = table.indices ?? [];
          table.indices.push(index);
          table.indices.forEach((entry, indexPosition) => {
            entry.id = indexPosition;
          });
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
          // The SQLite dialect keeps the target table on the ALTER statement
          // itself; other dialects may expose it on the expression.
          const tableName =
            expression.table?.[0]?.table ?? statement.table?.[0]?.table;
          const startTable = tables.find((table) => table.name === tableName);
          if (!startTable) return;

          const relationship = buildRelationship(
            startTable,
            (definition.definition ?? []).map((column: ASTNode) => column.column),
            definition.reference_definition,
            tables,
          );
          if (relationship) relationships.push(relationship);
        }
      });
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach(parseSingleStatement);
  } else {
    parseSingleStatement(ast);
  }

  return { tables, relationships };
}

function parseColumn(definition: ASTNode, diagramDb: DatabaseType): Field {
  const field: Field = {
    id: createId(),
    name: definition.column.column,
    fieldType: {
      type: canonicalTypeName(diagramDb, definition.definition.dataType),
    },
    fieldTypeSource: "imported",
    comment: definition.comment ? definition.comment.value.value : "",
    unique: Boolean(definition.unique),
    increment: Boolean(definition.auto_increment),
    notNull: Boolean(definition.nullable),
    primary: Boolean(definition.primary_key),
    default: "",
  };

  if (definition.definition.expr?.type === "expr_list") {
    field.values = definition.definition.expr.value.map(
      (value: ASTNode) => value.value,
    );
  }

  if (definition.default_val) {
    field.default = readDefaultValue(definition.default_val);
  }

  const length = definition.definition["length"];
  if (length !== undefined && length !== null) {
    const scale = definition.definition.scale;
    if (scale !== undefined && scale !== null) {
      field.fieldType.precision = Number(length);
      field.fieldType.scale = Number(scale);
    } else {
      field.fieldType.length = Number(length);
    }
  }

  field.check = definition.check
    ? buildSQLFromAST(definition.check.definition[0], "sqlite")
    : "";

  return field;
}

function applyConstraint(
  definition: ASTNode,
  table: Table,
  tables: Table[],
  relationships: Relationship[],
) {
  const constraintType = String(definition.constraint_type ?? "").toLowerCase();

  if (constraintType === "primary key") {
    (definition.definition ?? []).forEach((column: ASTNode) => {
      table.fields.forEach((field) => {
        if (field.name === column.column && !field.primary) {
          field.primary = true;
        }
      });
    });
    return;
  }

  if (constraintType === "foreign key") {
    const relationship = buildRelationship(
      table,
      (definition.definition ?? []).map((column: ASTNode) => column.column),
      definition.reference_definition,
      tables,
    );
    if (relationship) relationships.push(relationship);
    return;
  }

  if (constraintType.includes("unique")) {
    const fields = (definition.definition ?? []).map(
      (column: ASTNode) =>
        table.fields.find((f) => f.name === column.column)?.id ??
        column.column,
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

/**
 * Build a relationship from a foreign key reference definition.
 *
 * `startTable` owns the foreign key columns, `lookupTables` holds the
 * candidate target tables (self references resolve to `startTable`).
 */
function buildRelationship(
  startTable: Table,
  startFieldNames: string[],
  referenceDefinition: ASTNode | undefined,
  lookupTables: Table[],
): Relationship | undefined {
  if (!referenceDefinition) return undefined;

  const endTableName = referenceDefinition.table?.[0]?.table;
  const endFieldNames = (referenceDefinition.definition ?? []).map(
    (column: ASTNode) => column.column,
  );
  const startFieldName = startFieldNames[0];

  if (!endTableName || startFieldNames.length === 0) return undefined;

  const endTable = findReferencedTable(lookupTables, startTable, endTableName);
  if (!endTable) return undefined;

  const fieldPairs: RelationshipFieldPair[] = [];
  for (let i = 0; i < startFieldNames.length; i++) {
    const startField = findFieldByName(startTable.fields, startFieldNames[i]);
    const endField = findFieldByName(endTable.fields, endFieldNames[i]);
    if (!startField || !endField) break;
    fieldPairs.push({ startFieldId: startField.id, endFieldId: endField.id });
  }
  if (fieldPairs.length !== startFieldNames.length) return undefined;

  const startField = findFieldByName(startTable.fields, startFieldName);

  let updateConstraint = "No action";
  let deleteConstraint = "No action";
  (referenceDefinition.on_action ?? []).forEach((action: ASTNode) => {
    if (action.type === "on update") {
      updateConstraint = capitalize(String(action.value.value));
    } else if (action.type === "on delete") {
      deleteConstraint = capitalize(String(action.value.value));
    }
  });

  return {
    id: createId(),
    name: `fk_${startTable.name}_${startFieldName}_${endTableName}`,
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

/**
 * Read the index name from a `CREATE INDEX` statement.
 *
 * The SQLite dialect of node-sql-parser returns `{ schema, name }`, while
 * other dialects may return a plain string.
 */
function readIndexName(index: ASTNode | string | undefined): string {
  if (typeof index === "string") return index;
  return String(index?.name ?? "");
}
