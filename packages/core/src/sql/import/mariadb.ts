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
import type { ASTNode } from "./shared.ts";
import {
  addPrimaryKeyColumns,
  addUniqueKey,
  buildSQLFromAST,
  capitalize,
  fieldIdsOf,
  findFieldByName,
  findReferencedTable,
  readDefaultValue,
} from "./shared.ts";

const MARIADB_TABLE_COLOR = "#175e7a";

/**
 * Convert a MariaDB AST into tables and relationships.
 *
 * This is a faithful port of the React drawDB MariaDB importer
 * (`src/utils/importSQL/mariadb.js`), but written against the SDK data model:
 * `createId()` replaces nanoid and `canonicalTypeName()` replaces the
 * `dbToTypes` / affinity lookups.
 *
 * It is intentionally a standalone module (it does not re-export the MySQL
 * implementation) so the two dialects can diverge later.
 */
export function fromMariaDB(
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType = "mariadb",
): { tables: Table[]; relationships: Relationship[] } {
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
          color: MARIADB_TABLE_COLOR,
          fields: [],
          indices: [],
        };

        (statement.create_definitions ?? []).forEach((definition: ASTNode) => {
          if (definition.resource === "column") {
            const field = parseColumn(definition, diagramDb);
            table.fields.push(field);
            if (definition.primary_key) addPrimaryKeyColumns(table, [field.id]);
          } else if (definition.resource === "constraint") {
            applyConstraint(definition, table, tables, relationships);
          }
        });

        statement.table_options?.forEach((option: ASTNode) => {
          if (option.keyword === "comment") {
            table.comment = String(option.value).replace(/^["']|["']$/g, "");
          }
        });

        tables.push(table);
      } else if (statement.keyword === "index") {
        const table = tables.find((t) => t.name === statement.table.table);
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
          definition?.constraint_type?.toLowerCase() === "foreign key"
        ) {
          const startTable = tables.find(
            (table) => table.name === statement.table?.[0]?.table,
          );
          if (!startTable) return;

          const endTable = tables.find(
            (table) => table.name === definition.reference_definition?.table?.[0]?.table,
          );
          if (!endTable) return;

          const relationship = buildRelationship(
            definition,
            startTable,
            endTable,
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

/** Build a field from a column definition. */
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
    ? buildSQLFromAST(definition.check.definition[0], diagramDb)
    : "";

  return field;
}

/** Apply a table constraint: primary key, foreign key or unique constraint. */
function applyConstraint(
  definition: ASTNode,
  table: Table,
  tables: Table[],
  relationships: Relationship[],
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
    const endTableName = definition.reference_definition?.table?.[0]?.table;
    if (!endTableName) return;

    const endTable = findReferencedTable(tables, table, endTableName);
    if (!endTable) return;

    const relationship = buildRelationship(definition, table, endTable);
    if (relationship) relationships.push(relationship);
    return;
  }

  if (constraintType.includes("unique")) {
    const names = (definition.definition ?? []).map(
      (column: ASTNode) => column.column,
    );
    const fieldIds = fieldIdsOf(table, names);
    const name =
      definition.constraint ||
      definition.index ||
      `${table.name}_unique_${(table.uniqueKeys ?? []).length}`;
    addUniqueKey(table, name, fieldIds);
  }
}

/**
 * Build a relationship from a foreign key constraint definition.
 *
 * `startTable` owns the foreign key columns, `endTable` is the referenced
 * table (already resolved by the caller so self references work too).
 */
function buildRelationship(
  definition: ASTNode,
  startTable: Table,
  endTable: Table,
): Relationship | undefined {
  const startFieldNames = (definition.definition ?? []).map(
    (column: ASTNode) => column.column,
  );
  const endFieldNames = (definition.reference_definition?.definition ?? []).map(
    (column: ASTNode) => column.column,
  );

  if (startFieldNames.length === 0) return undefined;

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

  let updateConstraint = "No action";
  let deleteConstraint = "No action";
  (definition.reference_definition?.on_action ?? []).forEach(
    (action: ASTNode) => {
      if (action.type === "on update") {
        updateConstraint = capitalize(String(action.value.value));
      } else if (action.type === "on delete") {
        deleteConstraint = capitalize(String(action.value.value));
      }
    },
  );

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
