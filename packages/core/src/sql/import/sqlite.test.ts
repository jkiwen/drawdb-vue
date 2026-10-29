import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Cardinality } from "../../models/constants.ts";
import { parseSQL } from "./parser.ts";
import { fromSQLite } from "./sqlite.ts";

describe("fromSQLite", () => {
  it("imports a CREATE TABLE statement with fields and types", () => {
    const ast = parseSQL(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        age INT,
        name VARCHAR(100)
      );`,
      "sqlite",
    );

    const { tables, relationships } = fromSQLite(ast);

    assert.equal(tables.length, 1);
    assert.equal(relationships.length, 0);

    const table = tables[0];
    assert.equal(table.name, "users");
    assert.equal(table.comment, "");
    assert.equal(table.color, "#175e7a");
    assert.deepEqual(
      table.fields.map((field) => field.name),
      ["id", "email", "age", "name"],
    );

    const [id, email, age, name] = table.fields;
    assert.equal(id.fieldType.type, "INTEGER");
    assert.equal(id.primary, true);
    assert.equal(id.increment, true);
    assert.equal(id.notNull, false);

    assert.equal(email.fieldType.type, "TEXT");
    assert.equal(email.notNull, true);
    assert.equal(email.unique, true);

    // Unknown SQLite type names fall back to the canonical affinity table.
    assert.equal(age.fieldType.type, "INTEGER");
    assert.equal(name.fieldType.type, "VARCHAR");
    assert.equal(name.fieldType.length, 100);
  });

  it("marks table level primary key and unique constraints", () => {
    const ast = parseSQL(
      `CREATE TABLE accounts (
        id INTEGER NOT NULL,
        email TEXT,
        CONSTRAINT pk_accounts PRIMARY KEY (id),
        CONSTRAINT uq_accounts_email UNIQUE (email)
      );`,
      "sqlite",
    );

    const { tables } = fromSQLite(ast);
    const table = tables[0];

    assert.equal(table.fields[0].primary, true);
    assert.equal(table.fields[1].primary, false);

    assert.equal(table.uniqueConstraints?.length, 1);
    assert.equal(table.uniqueConstraints?.[0].name, "uq_accounts_email");
    assert.deepEqual(
      table.uniqueConstraints?.[0].fields.map(
        (id) => table.fields.find((f) => f.id === id)?.name,
      ),
      ["email"],
    );
    assert.equal(table.uniqueConstraints?.[0].id, 0);
  });

  it("creates a relationship for a foreign key constraint", () => {
    const ast = parseSQL(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE SET NULL
      );`,
      "sqlite",
    );

    const { tables, relationships } = fromSQLite(ast);

    assert.equal(tables.length, 2);
    assert.equal(relationships.length, 1);

    const relationship = relationships[0];
    const users = tables[0];
    const posts = tables[1];
    const userIdField = users.fields[0];
    const userIdColumn = posts.fields[1];

    assert.equal(relationship.name, "fk_posts_user_id_users");
    assert.equal(relationship.startTableId, posts.id);
    assert.equal(relationship.endTableId, users.id);
    assert.equal(relationship.startFieldId, userIdColumn.id);
    assert.equal(relationship.endFieldId, userIdField.id);
    assert.equal(relationship.cardinality, Cardinality.MANY_TO_ONE);
    assert.equal(relationship.updateConstraint, "Set null");
    assert.equal(relationship.deleteConstraint, "Cascade");
    assert.deepEqual(relationship.fields, [
      { startFieldId: userIdColumn.id, endFieldId: userIdField.id },
    ]);
  });

  it("creates a relationship for an inline column reference", () => {
    const ast = parseSQL(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users (id)
      );`,
      "sqlite",
    );

    const { tables, relationships } = fromSQLite(ast);

    assert.equal(relationships.length, 1);
    assert.equal(relationships[0].name, "fk_posts_user_id_users");
    assert.equal(relationships[0].startTableId, tables[1].id);
    assert.equal(relationships[0].endTableId, tables[0].id);
    assert.equal(relationships[0].updateConstraint, "No action");
    assert.equal(relationships[0].deleteConstraint, "No action");
  });

  it("imports CREATE INDEX statements", () => {
    const ast = parseSQL(
      `CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        title TEXT
      );
      CREATE INDEX idx_posts_title ON posts (title);
      CREATE UNIQUE INDEX uq_posts_title_id ON posts (title, id);`,
      "sqlite",
    );

    const { tables } = fromSQLite(ast);
    const table = tables[0];

    assert.equal(table.indices?.length, 2);
    assert.equal(table.indices?.[0].name, "idx_posts_title");
    assert.equal(table.indices?.[0].unique, false);
    assert.deepEqual(
      (table.indices?.[0].fields ?? []).map(
        (id) => table.fields.find((f) => f.id === id)?.name,
      ),
      ["title"],
    );
    assert.equal(table.indices?.[0].id, 0);

    assert.equal(table.indices?.[1].name, "uq_posts_title_id");
    assert.equal(table.indices?.[1].unique, true);
    assert.deepEqual(
      (table.indices?.[1].fields ?? []).map(
        (id) => table.fields.find((f) => f.id === id)?.name,
      ),
      ["title", "id"],
    );
    assert.equal(table.indices?.[1].id, 1);
  });

  it("creates a relationship for an ALTER TABLE foreign key", () => {
    const ast = parseSQL(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER
      );
      ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users (id);`,
      "sqlite",
    );

    const { tables, relationships } = fromSQLite(ast);

    assert.equal(relationships.length, 1);
    assert.equal(relationships[0].name, "fk_posts_user_id_users");
    assert.equal(relationships[0].startTableId, tables[1].id);
    assert.equal(relationships[0].endTableId, tables[0].id);
  });
});
