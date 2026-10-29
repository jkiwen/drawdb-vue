import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromMariaDB } from "./mariadb.ts";
import { parseSQL } from "./parser.ts";

const parse = (sql: string) => parseSQL(sql, "mariadb");

describe("fromMariaDB", () => {
  it("imports a create table statement", () => {
    const ast = parse(
      "CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL);",
    );
    const { tables, relationships } = fromMariaDB(ast);

    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "users");
    assert.equal(tables[0].color, "#175e7a");
    assert.equal(tables[0].fields.length, 2);

    const [id, name] = tables[0].fields;
    assert.equal(id.name, "id");
    assert.equal(id.fieldType.type, "INTEGER");
    assert.deepEqual(tables[0].primaryKey?.columns, [{ fieldId: id.id }]);
    assert.equal(id.increment, true);
    assert.equal(name.name, "name");
    assert.equal(name.fieldType.type, "VARCHAR");
    assert.equal(name.fieldType.length, 255);

    assert.equal(relationships.length, 0);
  });

  it("marks auto increment columns", () => {
    const ast = parse(
      "CREATE TABLE items (id INT AUTO_INCREMENT, label VARCHAR(50));",
    );
    const { tables } = fromMariaDB(ast);

    assert.equal(tables[0].fields[0].increment, true);
    assert.equal(tables[0].fields[1].increment, false);
  });

  it("imports a foreign key as a relationship", () => {
    const ast = parse(`
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (
        id INT PRIMARY KEY,
        user_id INT,
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    const { tables, relationships } = fromMariaDB(ast);

    assert.equal(tables.length, 2);
    assert.equal(relationships.length, 1);

    const users = tables.find((t) => t.name === "users")!;
    const posts = tables.find((t) => t.name === "posts")!;
    const relationship = relationships[0];

    assert.equal(relationship.name, "fk_posts_user_id_users");
    assert.equal(relationship.startTableId, posts.id);
    assert.equal(relationship.endTableId, users.id);
    assert.equal(relationship.startFieldId, posts.fields[1].id);
    assert.equal(relationship.endFieldId, users.fields[0].id);
    assert.equal(relationship.cardinality, "many_to_one");
    // The mariadb dialect of node-sql-parser reports the action in lower case,
    // so the React importer also produces "Cascade" here.
    assert.equal(relationship.deleteConstraint, "Cascade");
    assert.equal(relationship.updateConstraint, "No action");
    assert.deepEqual(relationship.fields, [
      { startFieldId: posts.fields[1].id, endFieldId: users.fields[0].id },
    ]);
  });

  it("imports unique constraints and indices", () => {
    const ast = parse(`
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(255),
        CONSTRAINT uq_email UNIQUE (email)
      );
      CREATE INDEX idx_email ON users (email);
    `);
    const { tables } = fromMariaDB(ast);
    const users = tables[0];

    assert.equal(users.uniqueKeys?.length, 1);
    assert.equal(users.uniqueKeys?.[0].name, "uq_email");
    assert.equal(users.uniqueKeys?.[0].logicalName, "uq_email");
    assert.deepEqual(
      users.uniqueKeys?.[0].columns.map(
        (column) => users.fields.find((f) => f.id === column.fieldId)?.name,
      ),
      ["email"],
    );

    assert.equal(users.indices?.length, 1);
    assert.equal(users.indices?.[0].name, "idx_email");
    assert.deepEqual(
      users.indices?.[0].columns.map(
        (column) => users.fields.find((f) => f.id === column.fieldId)?.name,
      ),
      ["email"],
    );
  });

  it("imports an alter table add foreign key as a relationship", () => {
    // The mariadb grammar of node-sql-parser cannot parse
    // `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`, so the statement is
    // read with the mysql grammar; the AST shape is identical.
    const ast = parseSQL(
      `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (id INT PRIMARY KEY, user_id INT);
      ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id);
    `,
      "mysql",
    );
    const { relationships } = fromMariaDB(ast);

    assert.equal(relationships.length, 1);
    assert.equal(relationships[0].name, "fk_posts_user_id_users");
    assert.equal(relationships[0].cardinality, "many_to_one");
  });

  it("applies a table level primary key constraint", () => {
    const ast = parse(
      "CREATE TABLE t (a INT, b INT, CONSTRAINT pk_t PRIMARY KEY (a));",
    );
    const { tables } = fromMariaDB(ast);

    assert.deepEqual(tables[0].primaryKey?.columns, [
      { fieldId: tables[0].fields[0].id },
    ]);
  });

  it("uses mariadb type canonicalisation", () => {
    const ast = parse(
      "CREATE TABLE t (a INT, b MEDIUMINT, c JSON, d DECIMAL(10,2));",
    );
    const { tables } = fromMariaDB(ast);

    assert.equal(tables[0].fields[0].fieldType.type, "INTEGER");
    assert.equal(tables[0].fields[1].fieldType.type, "MEDIUMINT");
    assert.equal(tables[0].fields[2].fieldType.type, "JSON");
    assert.equal(tables[0].fields[3].fieldType.type, "DECIMAL");
    assert.equal(tables[0].fields[3].fieldType.precision, 10);
    assert.equal(tables[0].fields[3].fieldType.scale, 2);
  });
});
