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
  addPrimaryKeyColumns,
  addUniqueKey,
  capitalize,
  fieldIdsOf,
  findFieldByName,
  findReferencedTable,
  readDefaultValue,
} from "./shared.ts";

const MSSQL_TABLE_COLOR = "#175e7a";

/** A foreign key that still has to be linked to its target table. */
interface PendingForeignKey {
  startTable: Table;
  startFieldNames: string[];
  endTableName: string;
  endFieldNames: string[];
  updateConstraint: string;
  deleteConstraint: string;
}

/**
 * Convert a Microsoft SQL Server AST into tables and relationships.
 *
 * The AST is produced by the dedicated T-SQL parser in `mssql-parser.ts`,
 * because the `transactsql` grammar of `node-sql-parser` cannot express
 * foreign keys. Foreign keys are resolved after every table is known, so a
 * table may reference a table that is created later in the script.
 */
export function fromMSSQL(
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType = "mssql",
): ImportedDiagramFragment {
  const tables: Table[] = [];
  const pending: PendingForeignKey[] = [];

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
          color: MSSQL_TABLE_COLOR,
          fields: [],
          indices: [],
        };

        (statement.create_definitions ?? []).forEach((definition: ASTNode) => {
          if (definition.resource === "column") {
            const field = parseColumn(definition, diagramDb);
            table.fields.push(field);
            if (definition.primary_key) addPrimaryKeyColumns(table, [field.id]);

            if (definition.reference_definition) {
              pending.push(
                buildPendingForeignKey(
                  table,
                  [field.name],
                  definition.reference_definition,
                ),
              );
            }
          } else if (definition.resource === "constraint") {
            applyConstraint(definition, table, pending);
          }
        });

        tables.push(table);
      } else if (statement.keyword === "index") {
        const table = tables.find((entry) => entry.name === statement.table.table);
        if (table) {
          const index = {
            name: statement.index,
            unique: statement.index_type === "unique",
            columns: (statement.index_columns ?? []).map((column: ASTNode) => ({
              fieldId:
                table.fields.find((f) => f.name === column.column)?.id ??
                column.column,
            })),
          };

          table.indices = table.indices ?? [];
          table.indices.push(index);
          table.indices.forEach((entry, position) => {
            entry.id = position;
          });
        }
      }
    } else if (statement.type === "alter") {
      // The altered table is named on the statement node, not on the
      // individual expression.
      const alteredTableName = statement.table?.[0]?.table;

      (statement.expr ?? []).forEach((expression: ASTNode) => {
        const definition = expression.create_definitions;
        if (expression.action !== "add" || !definition) return;
        if (String(definition.constraint_type ?? "").toLowerCase() !== "foreign key") {
          return;
        }

        const startTable = tables.find((entry) => entry.name === alteredTableName);
        if (!startTable) return;

        pending.push(
          buildPendingForeignKey(
            startTable,
            (definition.definition ?? []).map((column: ASTNode) => column.column),
            definition.reference_definition,
          ),
        );
      });
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach(parseSingleStatement);
  } else {
    parseSingleStatement(ast);
  }

  const relationships: Relationship[] = [];
  pending.forEach((foreignKey) => {
    const relationship = resolveForeignKey(foreignKey, tables);
    if (relationship) relationships.push(relationship);
  });

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
    comment: "",
    unique: Boolean(definition.unique),
    increment: Boolean(definition.auto_increment),
    notNull: definition.nullable?.type === "not null",
    default: "",
    check: "",
  };

  if (definition.default_val) {
    field.default = readDefaultValue(definition.default_val);
  }

  const length = definition.definition.length;
  if (length !== undefined && length !== null) {
    const scale = definition.definition.scale;
    if (scale !== undefined && scale !== null) {
      field.fieldType.precision = Number(length);
      field.fieldType.scale = Number(scale);
    } else {
      field.fieldType.length = Number(length);
    }
  }

  if (definition.check) {
    field.check = String(definition.check.definition?.[0]?.value ?? "");
  }

  return field;
}

function applyConstraint(
  definition: ASTNode,
  table: Table,
  pending: PendingForeignKey[],
) {
  const constraintType = String(definition.constraint_type ?? "").toLowerCase();

  if (constraintType === "primary key") {
    const names = (definition.definition ?? []).map(
      (column: ASTNode) => column.column,
    );
    addPrimaryKeyColumns(table, fieldIdsOf(table, names));
    return;
  }

  if (constraintType === "foreign key") {
    pending.push(
      buildPendingForeignKey(
        table,
        (definition.definition ?? []).map((column: ASTNode) => column.column),
        definition.reference_definition,
      ),
    );
    return;
  }

  if (constraintType.includes("unique")) {
    const names = (definition.definition ?? []).map(
      (column: ASTNode) => column.column,
    );
    const fieldIds = fieldIdsOf(table, names);
    const name =
      definition.constraint ||
      `${table.name}_unique_${(table.uniqueKeys ?? []).length}`;
    addUniqueKey(table, name, fieldIds);
  }
}

/** Collect the parts of a foreign key that are known before it is resolved. */
function buildPendingForeignKey(
  startTable: Table,
  startFieldNames: string[],
  reference: ASTNode | undefined,
): PendingForeignKey {
  let updateConstraint = "No action";
  let deleteConstraint = "No action";

  (reference?.on_action ?? []).forEach((action: ASTNode) => {
    if (action.type === "on update") {
      updateConstraint = capitalize(String(action.value.value));
    } else if (action.type === "on delete") {
      deleteConstraint = capitalize(String(action.value.value));
    }
  });

  return {
    startTable,
    startFieldNames,
    endTableName: reference?.table?.[0]?.table ?? "",
    endFieldNames: (reference?.definition ?? []).map(
      (column: ASTNode) => column.column,
    ),
    updateConstraint,
    deleteConstraint,
  };
}

/**
 * Link a pending foreign key to its target table.
 *
 * When the reference does not name any columns, the primary key of the
 * referenced table is used.
 */
function resolveForeignKey(
  foreignKey: PendingForeignKey,
  tables: Table[],
): Relationship | undefined {
  const { startTable, startFieldNames } = foreignKey;
  if (!foreignKey.endTableName || startFieldNames.length === 0) return undefined;

  const endTable = findReferencedTable(
    tables,
    startTable,
    foreignKey.endTableName,
  );
  if (!endTable) return undefined;

  let endFieldNames = foreignKey.endFieldNames;
  if (endFieldNames.length === 0) {
    const primaryIds = new Set(
      (endTable.primaryKey?.columns ?? []).map((column) => String(column.fieldId)),
    );
    endFieldNames = endTable.fields
      .filter((field) => primaryIds.has(String(field.id)))
      .map((field) => field.name);
  }
  if (endFieldNames.length === 0) return undefined;

  const fieldPairs: RelationshipFieldPair[] = [];
  for (let i = 0; i < startFieldNames.length; i++) {
    const startField = findFieldByName(startTable.fields, startFieldNames[i]);
    const endField = findFieldByName(endTable.fields, endFieldNames[i]);
    if (!startField || !endField) break;
    fieldPairs.push({ startFieldId: startField.id, endFieldId: endField.id });
  }
  if (fieldPairs.length !== startFieldNames.length) return undefined;

  const startFieldName = startFieldNames[0];
  const startField = findFieldByName(startTable.fields, startFieldName);

  return {
    id: createId(),
    name: `fk_${startTable.name}_${startFieldName}_${endTable.name}`,
    startTableId: startTable.id,
    endTableId: endTable.id,
    startFieldId: fieldPairs[0].startFieldId,
    endFieldId: fieldPairs[0].endFieldId,
    fields: fieldPairs,
    updateConstraint: foreignKey.updateConstraint,
    deleteConstraint: foreignKey.deleteConstraint,
    cardinality: startField?.unique
      ? Cardinality.ONE_TO_ONE
      : Cardinality.MANY_TO_ONE,
  };
}
