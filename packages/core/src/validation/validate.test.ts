import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Enum } from "../models/enum.ts";
import type { Field } from "../models/field.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import type { CustomType } from "../models/type.ts";
import type { View } from "../models/view.ts";
import { isDefaultValid, validateDiagram } from "./validate.ts";

/** The codes of the issues of a diagram. */
function codes(diagram: Diagram, options?: Parameters<typeof validateDiagram>[1]) {
  return validateDiagram(diagram, options).map((issue) => issue.code);
}

function table(overrides: Partial<Table> & { id: string }): Table {
  const base: Table = {
    id: overrides.id,
    name: "table",
    x: 0,
    y: 0,
    fields: [],
    logical: { id: `le-${overrides.id}`, name: "table", attributes: [] },
  };
  const merged = { ...base, ...overrides };
  if (overrides.logical === undefined) {
    merged.logical = { id: `le-${merged.id}`, name: merged.name, attributes: [] };
  }
  return merged;
}

function field(overrides: Partial<Field> & { id: string }): Field {
  return {
    name: "field",
    fieldType: { type: "INTEGER" },
    fieldTypeSource: "explicit",
    ...overrides,
  };
}

function relationship(
  overrides: Partial<Relationship> & { id: string },
): Relationship {
  return {
    startTableId: "t1",
    startFieldId: "f1",
    endTableId: "t2",
    endFieldId: "f2",
    ...overrides,
  };
}

test("validation: returns no issue for an empty diagram", () => {
  assert.deepEqual(codes(createEmptyDiagram()), []);
});

test("validation: reports a table without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(table({ id: "t1", name: "" }));

  assert.ok(codes(diagram).includes("table.no_name"));
});

test("validation: reports a duplicate table name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(table({ id: "t1", name: "users" }));
  diagram.tables.push(table({ id: "t2", name: "users" }));

  assert.ok(codes(diagram).includes("table.duplicate_name"));
});

test("validation: does not report two tables with different names", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(table({ id: "t1", name: "users" }));
  diagram.tables.push(table({ id: "t2", name: "posts" }));

  assert.ok(!codes(diagram).includes("table.duplicate_name"));
});

test("validation: reports a table without a primary key", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({ id: "t1", name: "users", fields: [field({ id: "f1" })] }),
  );

  assert.ok(codes(diagram).includes("table.no_primary_key"));
});

test("validation: does not report a table with a primary key", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(!codes(diagram).includes("table.no_primary_key"));
});

test("validation: reports a field without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({ id: "t1", name: "users", fields: [field({ id: "f1", name: "" })] }),
  );

  assert.ok(codes(diagram).includes("field.no_name"));
});

test("validation: reports a field without a type", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({ id: "t1", name: "users", fields: [field({ id: "f1", fieldType: { type: "" } })] }),
  );

  assert.ok(codes(diagram).includes("field.no_type"));
});

test("validation: reports an enum field without values", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1", fieldType: { type: "ENUM" }, values: [] })],
    }),
  );

  assert.ok(codes(diagram).includes("field.no_values"));
});

test("validation: reports a duplicate field name inside one table", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [
        field({ id: "f1", name: "id" }),
        field({ id: "f2", name: "id" }),
      ],
    }),
  );

  assert.ok(codes(diagram).includes("field.duplicate_name"));
});

test("validation: does not report the same field name in two tables", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1", name: "id" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.tables.push(
    table({
      id: "t2",
      name: "posts",
      fields: [field({ id: "f2", name: "id" })],
      primaryKey: {
        id: "pk_t2",
        name: "PK_posts",
        logicalName: "PK_posts",
        columns: [{ fieldId: "f2" }],
      },
    }),
  );

  assert.ok(!codes(diagram).includes("field.duplicate_name"));
});

test("validation: reports a default that does not match the type", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1", fieldType: { type: "INTEGER" }, default: "abc" })],
    }),
  );

  assert.ok(codes(diagram).includes("field.default_mismatch"));
});

test("validation: accepts a numeric default for a numeric type", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1", fieldType: { type: "INTEGER" }, default: "42" })],
    }),
  );

  assert.ok(!codes(diagram).includes("field.default_mismatch"));
});

test("validation: accepts a keyword default for a date field", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1", fieldType: { type: "TIMESTAMP" }, default: "CURRENT_TIMESTAMP" })],
    }),
  );

  assert.ok(!codes(diagram).includes("field.default_mismatch"));
});

test("validation: reports a field that is not null and nullable", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [
        field({ id: "f1", notNull: true, nullable: true }),
      ],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("field.not_null_is_null"));
});

test("validation: reports a relationship whose table is missing", () => {
  const diagram = createEmptyDiagram();
  diagram.relationships.push(relationship({ id: "r1" }));

  assert.ok(codes(diagram).includes("relationship.missing_table"));
});

test("validation: reports a relationship whose field is missing", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.tables.push(
    table({ id: "t2", name: "posts", fields: [field({ id: "f2" })] }),
  );
  diagram.relationships.push(
    relationship({ id: "r1", startFieldId: "missing", endFieldId: "f1" }),
  );

  assert.ok(codes(diagram).includes("relationship.missing_field"));
});

test("validation: reports a duplicate relationship name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.tables.push(
    table({ id: "t2", name: "posts", fields: [field({ id: "f2" })] }),
  );
  diagram.relationships.push(relationship({ id: "r1", name: "fk_users" }));
  diagram.relationships.push(
    relationship({ id: "r2", name: "fk_users", endFieldId: "f1" }),
  );

  assert.ok(codes(diagram).includes("relationship.duplicate_name"));
});

test("validation: reports a circular relationship once", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "a",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_a",
        logicalName: "PK_a",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.tables.push(
    table({
      id: "t2",
      name: "b",
      fields: [field({ id: "f2" })],
      primaryKey: {
        id: "pk_t2",
        name: "PK_b",
        logicalName: "PK_b",
        columns: [{ fieldId: "f2" }],
      },
    }),
  );
  diagram.relationships.push(
    relationship({ id: "r1", startTableId: "t1", endTableId: "t2" }),
  );
  diagram.relationships.push(
    relationship({
      id: "r2",
      startTableId: "t2",
      endTableId: "t1",
      startFieldId: "f2",
      endFieldId: "f1",
    }),
  );

  const circular = codes(diagram).filter(
    (code) => code === "relationship.circular",
  );
  assert.equal(circular.length, 1);
});

test("validation: reports a view without a base table", () => {
  const diagram = createEmptyDiagram();
  diagram.views.push({
    id: "v1",
    name: "active_users",
    x: 0,
    y: 0,
    baseTableId: "missing",
  } satisfies View);

  assert.ok(codes(diagram).includes("view.no_base_table"));
});

test("validation: reports a view whose name clashes with a table", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "users",
    x: 0,
    y: 0,
    baseTableId: "t1",
  } satisfies View);

  assert.ok(codes(diagram).includes("view.name_clashes_table"));
});

test("validation: reports a view without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.views.push({ id: "v1", name: "", x: 0, y: 0 } satisfies View);

  assert.ok(codes(diagram).includes("view.no_name"));
});

test("validation: reports a duplicate view name", () => {
  const diagram = createEmptyDiagram();
  diagram.views.push({ id: "v1", name: "v", x: 0, y: 0 } satisfies View);
  diagram.views.push({ id: "v2", name: "v", x: 0, y: 0 } satisfies View);

  assert.ok(codes(diagram).includes("view.duplicate_name"));
});

test("validation: reports a join without a table", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "v",
    x: 0,
    y: 0,
    baseTableId: "t1",
    joins: [{ type: "INNER", tableId: null, on: null }],
  } satisfies View);

  assert.ok(codes(diagram).includes("join.no_table"));
});

test("validation: reports a join without a condition", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "v",
    x: 0,
    y: 0,
    baseTableId: "t1",
    joins: [{ type: "INNER", tableId: "t1", on: null }],
  } satisfies View);

  assert.ok(codes(diagram).includes("join.no_condition"));
});

test("validation: reports a join that is out of order", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.tables.push(
    table({
      id: "t2",
      name: "posts",
      fields: [field({ id: "f2" })],
      primaryKey: {
        id: "pk_t2",
        name: "PK_posts",
        logicalName: "PK_posts",
        columns: [{ fieldId: "f2" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "v",
    x: 0,
    y: 0,
    baseTableId: "t1",
    joins: [
      {
        type: "INNER",
        tableId: "t2",
        on: { leftTableId: "t2", leftFieldId: "f2", rightFieldId: "f1" },
      },
    ],
  } satisfies View);

  assert.ok(codes(diagram).includes("join.out_of_order"));
});

test("validation: reports a view column without a field", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "v",
    x: 0,
    y: 0,
    baseTableId: "t1",
    columns: [{ tableId: "t1", fieldId: "missing", alias: "x" }],
  } satisfies View);

  assert.ok(codes(diagram).includes("view_column.no_field"));
});

test("validation: reports a duplicate view column name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );
  diagram.views.push({
    id: "v1",
    name: "v",
    x: 0,
    y: 0,
    baseTableId: "t1",
    columns: [
      { tableId: "t1", fieldId: "f1", alias: "x" },
      { tableId: "t1", fieldId: "f1", alias: "x" },
    ],
  } satisfies View);

  assert.ok(codes(diagram).includes("view_column.duplicate_name"));
});

test("validation: reports an index without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      indices: [{ name: "", unique: false, columns: [{ fieldId: "f1" }] }],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("index.no_name"));
});

test("validation: reports an index without fields", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      indices: [{ name: "idx", unique: false, columns: [] }],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("index.no_fields"));
});

test("validation: reports a duplicate index name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      indices: [
        { name: "idx", unique: false, columns: [{ fieldId: "f1" }] },
        { name: "idx", unique: false, columns: [{ fieldId: "f1" }] },
      ],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("index.duplicate_name"));
});

test("validation: reports a unique constraint without fields", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      uniqueKeys: [
        { id: "uk_t1_1", logicalName: "uq", name: "uq", columns: [] },
      ],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("unique_constraint.no_fields"));
});

test("validation: reports a duplicate unique constraint name", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({
      id: "t1",
      name: "users",
      fields: [field({ id: "f1" })],
      uniqueKeys: [
        { id: "uk_t1_1", logicalName: "uq", name: "uq", columns: [{ fieldId: "f1" }] },
        { id: "uk_t1_2", logicalName: "uq", name: "uq", columns: [{ fieldId: "f1" }] },
      ],
      primaryKey: {
        id: "pk_t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    }),
  );

  assert.ok(codes(diagram).includes("unique_constraint.duplicate_name"));
});

test("validation: reports a custom type without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({ name: "", fields: [] } satisfies CustomType);

  assert.ok(codes(diagram).includes("type.no_name"));
});

test("validation: reports a duplicate custom type name", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({ name: "money", fields: [] } satisfies CustomType);
  diagram.types.push({ name: "money", fields: [] } satisfies CustomType);

  assert.ok(codes(diagram).includes("type.duplicate_name"));
});

test("validation: reports a custom type without fields", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({ name: "money", fields: [] } satisfies CustomType);

  assert.ok(codes(diagram).includes("type.no_fields"));
});

test("validation: reports a custom type field without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({
    name: "money",
    fields: [{ name: "", type: "INTEGER" }],
  } satisfies CustomType);

  assert.ok(codes(diagram).includes("type_field.no_name"));
});

test("validation: reports a custom type field without a type", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({
    name: "money",
    fields: [{ name: "amount", type: "" }],
  } satisfies CustomType);

  assert.ok(codes(diagram).includes("type_field.no_type"));
});

test("validation: reports a duplicate custom type field name", () => {
  const diagram = createEmptyDiagram();
  diagram.types.push({
    name: "money",
    fields: [
      { name: "amount", type: "INTEGER" },
      { name: "amount", type: "INTEGER" },
    ],
  } satisfies CustomType);

  assert.ok(codes(diagram).includes("type_field.duplicate_name"));
});

test("validation: reports an enum without a name", () => {
  const diagram = createEmptyDiagram();
  diagram.enums.push({ name: "", values: ["a"] } satisfies Enum);

  assert.ok(codes(diagram).includes("enum.no_name"));
});

test("validation: reports a duplicate enum name", () => {
  const diagram = createEmptyDiagram();
  diagram.enums.push({ name: "state", values: ["a"] } satisfies Enum);
  diagram.enums.push({ name: "state", values: ["a"] } satisfies Enum);

  assert.ok(codes(diagram).includes("enum.duplicate_name"));
});

test("validation: reports an enum without values", () => {
  const diagram = createEmptyDiagram();
  diagram.enums.push({ name: "state", values: [] } satisfies Enum);

  assert.ok(codes(diagram).includes("enum.no_values"));
});

test("validation: filters by severity", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(
    table({ id: "t1", name: "users", fields: [field({ id: "f1" })] }),
  );
  diagram.tables.push(
    table({
      id: "t2",
      name: "posts",
      fields: [field({ id: "f2", name: "" })],
      primaryKey: {
        id: "pk_t2",
        name: "PK_posts",
        logicalName: "PK_posts",
        columns: [{ fieldId: "f2" }],
      },
    }),
  );

  const all = validateDiagram(diagram);
  assert.ok(all.some((issue) => issue.severity === "error"));
  assert.ok(all.some((issue) => issue.severity === "warning"));

  const errors = validateDiagram(diagram, { severity: "error" });
  assert.ok(errors.length > 0);
  assert.ok(errors.every((issue) => issue.severity === "error"));
});

test("validation: never throws for a malformed diagram", () => {
  const diagram = { database: "generic" } as unknown as Diagram;

  const issues = validateDiagram(diagram);
  assert.ok(issues.length > 0);
  assert.ok(issues.every((issue) => issue.severity === "error"));
});

test("validation: the issue carries the localization parameters", () => {
  const diagram = createEmptyDiagram();
  diagram.tables.push(table({ id: "t1", name: "" }));

  const issue = validateDiagram(diagram).find(
    (entry) => entry.code === "table.no_name",
  );
  assert.ok(issue);
  assert.equal(issue?.tableId, "t1");
  assert.equal(typeof issue?.message, "string");
});

test("validation: isDefaultValid accepts the values of every kind", () => {
  assert.equal(isDefaultValid("numeric", "42"), true);
  assert.equal(isDefaultValid("numeric", "abc"), false);
  assert.equal(isDefaultValid("boolean", "true"), true);
  assert.equal(isDefaultValid("boolean", "yes"), false);
  assert.equal(isDefaultValid("date", "2024-01-31"), true);
  assert.equal(isDefaultValid("date", "2024-13-45"), false);
  assert.equal(isDefaultValid("date", "CURRENT_TIMESTAMP"), true);
  assert.equal(isDefaultValid("text", "anything"), true);
  assert.equal(isDefaultValid("none", "anything"), true);
  assert.equal(isDefaultValid(undefined, "anything"), true);
  assert.equal(isDefaultValid("numeric", ""), true);
  assert.equal(isDefaultValid("numeric", "now()"), true);
});
