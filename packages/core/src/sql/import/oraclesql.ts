import type { DatabaseType } from "../../models/diagram.ts";
import { Cardinality, Constraint } from "../../models/constants.ts";
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
  capitalize,
  fieldIdsOf,
  findFieldByName,
  findReferencedTable,
} from "./shared.ts";

const ORACLE_TABLE_COLOR = "#175e7a";

/**
 * Type aliases the React Oracle importer resolved through its affinity table
 * before falling back to `BLOB`. The SDK type registry does not know the
 * `NUMERIC`, `DECIMAL` and `CHARACTER` aliases of the Oracle dialect, so they
 * are mapped here before the canonical name is resolved.
 */
const ORACLE_TYPE_ALIASES: Record<string, string> = {
  INT: "INTEGER",
  NUMERIC: "NUMBER",
  DECIMAL: "NUMBER",
  CHARACTER: "CHAR",
};

/**
 * Oracle AST node for the `CREATE TABLE` statement produced by
 * `oracle-sql-parser`.
 *
 * The Oracle grammar is completely different from the node-sql-parser one:
 * there is no `create_definitions` list, the columns live in
 * `table.relational_properties` and the type of a column carries the
 * precision / scale / size directly.
 */
interface OracleCreateTableStatement extends ASTNode {
  operation: "create";
  object: "table";
  name: { schema?: string | null; name: string };
  table: {
    relational_properties?: OracleRelationalProperty[];
  };
}

/** A column definition or a table constraint. */
interface OracleRelationalProperty extends ASTNode {
  resource: "column" | "constraint";
  name?: string | null;
  type?: {
    type: string;
    precision?: number | null;
    scale?: number | null;
    size?: number | null;
  };
  constraints?: OracleColumnConstraint[];
  identity?: unknown;
  default?: { on_null?: unknown; expr?: unknown } | null;
  constraint?: {
    primary_key?: string;
    not_null?: string;
    unique?: string;
    columns?: string[];
    reference?: {
      object: { schema?: string | null; name: string };
      columns?: string[];
      on_delete?: string | null;
    } | null;
  };
}

/** A single column level constraint (`NOT NULL`, `PRIMARY KEY`, `UNIQUE`). */
interface OracleColumnConstraint extends ASTNode {
  resource?: "constraint";
  name?: string | null;
  constraint?: {
    primary_key?: string;
    not_null?: string;
    unique?: string;
  };
}

/**
 * Convert an Oracle SQL AST into tables and relationships.
 *
 * This is a faithful port of the React drawDB Oracle importer
 * (`src/utils/importSQL/oraclesql.js`), written against the SDK data model:
 * `createId()` replaces nanoid and `canonicalTypeName()` replaces the
 * `dbToTypes` / affinity lookups.
 *
 * Note that the Oracle AST is produced by `oracle-sql-parser`, which has a
 * completely different shape than the node-sql-parser AST used by the MySQL
 * importer, so the traversal is re-implemented here rather than shared.
 */
export function fromOracleSQL(
  ast: ASTNode | ASTNode[],
  diagramDb: DatabaseType = "oraclesql",
): { tables: Table[]; relationships: Relationship[] } {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];

  const parseSingleStatement = (statement: ASTNode) => {
    if (statement.operation !== "create") return;
    if (statement.object !== "table") return;

    const createTable = statement as OracleCreateTableStatement;

    const table: Table = {
      id: createId(),
      name: createTable.name.name,
      logical: {
        id: createId(),
        name: createTable.name.name,
        attributes: [],
      },
      x: 0,
      y: 0,
      comment: "",
      color: ORACLE_TABLE_COLOR,
      fields: [],
      indices: [],
    };

    (createTable.table?.relational_properties ?? []).forEach(
      (property: OracleRelationalProperty) => {
        if (property.resource === "column") {
          const field = parseColumn(property, diagramDb);
          table.fields.push(field);
          if (hasPrimaryKeyConstraint(property)) {
            addPrimaryKeyColumns(table, [field.id]);
          }
        } else if (property.resource === "constraint") {
          applyConstraint(property, table, tables, relationships);
        }
      },
    );

    tables.push(table);
  };

  if (Array.isArray(ast)) {
    ast.forEach(parseSingleStatement);
  } else {
    parseSingleStatement(ast);
  }

  return { tables, relationships };
}

/** Build a field from an Oracle column definition. */
function parseColumn(
  definition: OracleRelationalProperty,
  diagramDb: DatabaseType,
): Field {
  const rawType = String(definition.type?.type ?? "").toUpperCase();

  const field: Field = {
    id: createId(),
    name: definition.name ?? "",
    fieldType: {
      type: canonicalTypeName(diagramDb, ORACLE_TYPE_ALIASES[rawType] ?? rawType),
    },
    fieldTypeSource: "imported",
    comment: "",
    check: "",
    default: "",
    unique: false,
    increment: false,
    notNull: false,
  };

  const precision = definition.type?.precision;
  const scale = definition.type?.scale;
  const size = definition.type?.size;

  const resolvedSize = size || precision;
  if (scale && precision) {
    field.fieldType.precision = Number(precision);
    field.fieldType.scale = Number(scale);
  } else if (resolvedSize !== undefined && resolvedSize !== null) {
    field.fieldType.length = Number(resolvedSize);
  }

  (definition.constraints ?? []).forEach(
    (constraint: OracleColumnConstraint) => {
      if (constraint.constraint?.not_null === "not null") {
        field.notNull = true;
      }
      if (constraint.constraint?.unique === "unique") {
        field.unique = true;
      }
    },
  );

  if (definition.identity) {
    field.increment = true;
  }

  // TODO: reconstruct default when implemented in parser
  if (definition.default) {
    field.default = JSON.stringify(definition.default.expr);
  }

  return field;
}

/** Whether an Oracle column definition declares an inline primary key. */
function hasPrimaryKeyConstraint(
  definition: OracleRelationalProperty,
): boolean {
  return (definition.constraints ?? []).some(
    (constraint: OracleColumnConstraint) =>
      constraint.constraint?.primary_key === "primary key",
  );
}

/**
 * Apply a table level constraint: either a unique constraint or a foreign key
 * that becomes a relationship.
 */
function applyConstraint(
  definition: OracleRelationalProperty,
  table: Table,
  tables: Table[],
  relationships: Relationship[],
) {
  const constraint = definition.constraint;

  if (constraint?.unique === "unique" && Array.isArray(constraint.columns)) {
    const fieldIds = fieldIdsOf(table, constraint.columns as string[]);
    const name =
      definition.name && Boolean(definition.name.trim())
        ? definition.name
        : `${table.name}_unique_${(table.uniqueKeys ?? []).length}`;
    addUniqueKey(table, name, fieldIds);
    return;
  }

  if (!constraint?.reference) return;

  const relationship = buildRelationship(definition, table, tables);
  if (relationship) relationships.push(relationship);
}

/**
 * Build a relationship from an Oracle foreign key constraint.
 *
 * `startTable` owns the foreign key columns, `lookupTables` holds the
 * candidate target tables (self references resolve to `startTable`).
 */
function buildRelationship(
  definition: OracleRelationalProperty,
  startTable: Table,
  lookupTables: Table[],
): Relationship | undefined {
  const constraint = definition.constraint;
  const startFieldNames = constraint?.columns ?? [];
  const reference = constraint?.reference;
  const endFieldNames = reference?.columns ?? [];
  const endTableName = reference?.object?.name;

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

  const startFieldName = startFieldNames[0];
  const startField = findFieldByName(startTable.fields, startFieldName);

  const onDelete = reference?.on_delete;
  const deleteConstraint =
    onDelete && Boolean(onDelete.trim())
      ? capitalize(onDelete)
      : Constraint.NONE;

  return {
    id: createId(),
    name:
      definition.name && Boolean(definition.name.trim())
        ? definition.name
        : `fk_${startTable.name}_${startFieldName}_${endTableName}`,
    startTableId: startTable.id,
    endTableId: endTable.id,
    startFieldId: fieldPairs[0].startFieldId,
    endFieldId: fieldPairs[0].endFieldId,
    fields: fieldPairs,
    updateConstraint: Constraint.NONE,
    deleteConstraint,
    cardinality: startField?.unique
      ? Cardinality.ONE_TO_ONE
      : Cardinality.MANY_TO_ONE,
  };
}
