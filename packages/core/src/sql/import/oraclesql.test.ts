import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromOracleSQL } from "./oraclesql.ts";
import { parseSQL } from "./parser.ts";

const parse = (sql: string) => parseSQL(sql, "oraclesql");

describe("fromOracleSQL", () => {
  it("imports a create table statement with NUMBER and VARCHAR2 columns", () => {
    const ast = parse(`
      CREATE TABLE users (
        id NUMBER(10,0) PRIMARY KEY,
        email VARCHAR2(255) NOT NULL UNIQUE,
        name VARCHAR2(100)
      );
    `);
    const { tables, relationships } = fromOracleSQL(ast);

    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "users");
    assert.equal(tables[0].color, "#175e7a");
    assert.equal(tables[0].fields.length, 3);

    const [id, email, name] = tables[0].fields;
    assert.equal(id.name, "id");
    assert.equal(id.fieldType.type, "NUMBER");
    assert.deepEqual(tables[0].primaryKey?.columns, [{ fieldId: id.id }]);
    assert.equal(id.notNull, false);
    assert.equal(email.name, "email");
    assert.equal(email.fieldType.type, "VARCHAR2");
    assert.equal(email.fieldType.length, 255);
    assert.equal(email.notNull, true);
    assert.equal(email.unique, true);
    assert.equal(name.name, "name");
    assert.equal(name.fieldType.type, "VARCHAR2");
    assert.equal(name.fieldType.length, 100);
    assert.equal(tables[0].primaryKey?.columns.length, 1);

    assert.equal(relationships.length, 0);
  });

  it("imports a foreign key as a relationship", () => {
    const ast = parse(`
      CREATE TABLE departments (id NUMBER(10) PRIMARY KEY);
      CREATE TABLE users (
        id NUMBER(10) PRIMARY KEY,
        dept_id NUMBER(10),
        CONSTRAINT fk_users_dept FOREIGN KEY (dept_id) REFERENCES departments (id)
      );
    `);
    const { tables, relationships } = fromOracleSQL(ast);

    assert.equal(tables.length, 2);
    assert.equal(relationships.length, 1);

    const departments = tables.find((t) => t.name === "departments")!;
    const users = tables.find((t) => t.name === "users")!;
    const relationship = relationships[0];

    assert.equal(relationship.name, "fk_users_dept");
    assert.equal(relationship.startTableId, users.id);
    assert.equal(relationship.endTableId, departments.id);
    assert.equal(relationship.startFieldId, users.fields[1].id);
    assert.equal(relationship.endFieldId, departments.fields[0].id);
    assert.equal(relationship.cardinality, "many_to_one");
    assert.equal(relationship.updateConstraint, "No action");
    assert.equal(relationship.deleteConstraint, "No action");
    assert.deepEqual(relationship.fields, [
      { startFieldId: users.fields[1].id, endFieldId: departments.fields[0].id },
    ]);
  });

  it("imports a foreign key with an on delete cascade action", () => {
    const ast = parse(`
      CREATE TABLE users (id NUMBER(10) PRIMARY KEY);
      CREATE TABLE posts (
        id NUMBER(10) PRIMARY KEY,
        user_id NUMBER(10),
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);
    const { relationships } = fromOracleSQL(ast);

    assert.equal(relationships.length, 1);
    assert.equal(relationships[0].deleteConstraint, "Cascade");
    assert.equal(relationships[0].updateConstraint, "No action");
  });

  it("imports unique constraints, defaults and identity columns", () => {
    const ast = parse(`
      CREATE TABLE items (
        id NUMBER(10) GENERATED AS IDENTITY,
        label VARCHAR2(50),
        quantity NUMBER DEFAULT 5,
        CONSTRAINT uq_items_label UNIQUE (label)
      );
    `);
    const { tables } = fromOracleSQL(ast);
    const items = tables[0];

    assert.equal(items.fields[0].increment, true);
    assert.equal(items.fields[1].increment, false);
    assert.equal(items.fields[2].default, "5");

    assert.equal(items.uniqueKeys?.length, 1);
    assert.equal(items.uniqueKeys?.[0].name, "uq_items_label");
    assert.equal(items.uniqueKeys?.[0].logicalName, "uq_items_label");
    assert.equal(typeof items.uniqueKeys?.[0].id, "string");
    assert.deepEqual(
      items.uniqueKeys?.[0].columns.map(
        (column) => items.fields.find((f) => f.id === column.fieldId)?.name,
      ),
      ["label"],
    );
  });

  it("uses oracle type canonicalisation and keeps the precision and scale", () => {
    const ast = parse(`
      CREATE TABLE measurements (
        id INTEGER,
        amount NUMBER(10,2),
        ratio FLOAT,
        label INT
      );
    `);
    const { tables } = fromOracleSQL(ast);
    const fields = tables[0].fields;

    assert.equal(fields[0].fieldType.type, "INTEGER");
    assert.equal(fields[1].fieldType.type, "NUMBER");
    assert.equal(fields[1].fieldType.precision, 10);
    assert.equal(fields[1].fieldType.scale, 2);
    assert.equal(fields[2].fieldType.type, "FLOAT");
    assert.equal(fields[3].fieldType.type, "INTEGER");
  });

  it("maps the oracle type aliases of the React importer", () => {
    const ast = parse(`
      CREATE TABLE aliases (
        a NUMERIC,
        b DECIMAL,
        c INT,
        d CHARACTER(10)
      );
    `);
    const { tables } = fromOracleSQL(ast);
    const fields = tables[0].fields;

    assert.equal(fields[0].fieldType.type, "NUMBER");
    assert.equal(fields[1].fieldType.type, "NUMBER");
    assert.equal(fields[2].fieldType.type, "INTEGER");
    assert.equal(fields[3].fieldType.type, "CHAR");
  });

  it("accepts a single statement instead of a list", () => {
    const ast = parse("CREATE TABLE notes (id NUMBER(10) PRIMARY KEY);");
    const { tables, relationships } = fromOracleSQL(ast[0]);

    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "notes");
    assert.equal(tables[0].fields.length, 1);
    assert.equal(relationships.length, 0);
  });
});
