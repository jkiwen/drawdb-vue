import assert from "node:assert/strict";
import test from "node:test";
import { parseSQL } from "./parser.ts";
import { fromPostgres } from "./postgres.ts";

test("imports a table with a serial primary key, not null and a varchar size", () => {
  const ast = parseSQL(
    "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL);",
    "postgres",
  );

  const { tables, relationships } = fromPostgres(ast);

  assert.equal(tables.length, 1);
  const users = tables[0];
  assert.equal(users.name, "users");
  assert.equal(users.fields.length, 2);

  const id = users.fields[0];
  assert.equal(id.name, "id");
  assert.equal(id.fieldType.type, "SERIAL");
  assert.deepEqual(users.primaryKey?.columns, [{ fieldId: id.id }]);
  // React parity: `notNull` is only raised by an explicit NOT NULL, the
  // PostgreSQL grammar does not mark the primary key as such.
  assert.equal(id.notNull, false);

  const name = users.fields[1];
  assert.equal(name.name, "name");
  assert.equal(name.fieldType.type, "VARCHAR");
  assert.equal(name.fieldType.length, 255);
  assert.equal(name.notNull, true);
  assert.equal(users.primaryKey?.columns.length, 1);

  assert.equal(relationships.length, 0);
});

test("creates a relationship from a table level foreign key constraint", () => {
  const ast = parseSQL(
    `CREATE TABLE users (id SERIAL PRIMARY KEY);
     CREATE TABLE posts (
       id SERIAL PRIMARY KEY,
       user_id INT,
       CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id)
     );`,
    "postgres",
  );

  const { tables, relationships } = fromPostgres(ast);

  assert.equal(tables.length, 2);
  assert.equal(relationships.length, 1);

  const users = tables.find((table) => table.name === "users")!;
  const posts = tables.find((table) => table.name === "posts")!;
  const relationship = relationships[0];

  assert.equal(relationship.name, "fk_posts_user_id_users");
  assert.equal(relationship.startTableId, posts.id);
  assert.equal(relationship.endTableId, users.id);
  assert.equal(relationship.startFieldId, posts.fields[1].id);
  assert.equal(relationship.endFieldId, users.fields[0].id);
  assert.deepEqual(relationship.fields, [
    { startFieldId: posts.fields[1].id, endFieldId: users.fields[0].id },
  ]);
  assert.equal(relationship.cardinality, "many_to_one");
  assert.equal(relationship.updateConstraint, "No action");
  assert.equal(relationship.deleteConstraint, "No action");
});

test("creates a relationship from an inline column reference", () => {
  const ast = parseSQL(
    `CREATE TABLE users (id SERIAL PRIMARY KEY);
     CREATE TABLE posts (
       id SERIAL PRIMARY KEY,
       user_id INT REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT
     );`,
    "postgres",
  );

  const { tables, relationships } = fromPostgres(ast);

  assert.equal(relationships.length, 1);
  const relationship = relationships[0];

  const users = tables.find((table) => table.name === "users")!;
  const posts = tables.find((table) => table.name === "posts")!;

  assert.equal(relationship.name, "fk_posts_user_id_users");
  assert.equal(relationship.startFieldId, posts.fields[1].id);
  assert.equal(relationship.endFieldId, users.fields[0].id);
  assert.equal(relationship.deleteConstraint, "Cascade");
  assert.equal(relationship.updateConstraint, "Restrict");
});

test("imports unique constraints and indices", () => {
  const ast = parseSQL(
    `CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       email VARCHAR(255) NOT NULL,
       name VARCHAR(120),
       CONSTRAINT uq_users_email UNIQUE (email)
     );
     CREATE UNIQUE INDEX idx_users_name ON users (name);
     CREATE INDEX idx_users_id_name ON users (id, name);`,
    "postgres",
  );

  const { tables } = fromPostgres(ast);
  const users = tables[0];

  assert.equal(users.uniqueKeys?.length, 1);
  assert.equal(users.uniqueKeys?.[0].name, "uq_users_email");
  assert.deepEqual(
    users.uniqueKeys?.[0].columns.map(
      (column) => users.fields.find((f) => f.id === column.fieldId)?.name,
    ),
    ["email"],
  );

  assert.equal(users.indices?.length, 2);
  assert.equal(users.indices?.[0].name, "idx_users_name");
  assert.equal(users.indices?.[0].unique, true);
  assert.deepEqual(
    users.indices?.[0].columns.map(
      (column) => users.fields.find((f) => f.id === column.fieldId)?.name,
    ),
    ["name"],
  );
  assert.equal(users.indices?.[1].name, "idx_users_id_name");
  assert.equal(users.indices?.[1].unique, false);
  assert.deepEqual(
    users.indices?.[1].columns.map(
      (column) => users.fields.find((f) => f.id === column.fieldId)?.name,
    ),
    ["id", "name"],
  );
});

test("marks a column as unique when the constraint is inline", () => {
  const ast = parseSQL(
    "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE);",
    "postgres",
  );

  const { tables } = fromPostgres(ast);
  assert.equal(tables[0].fields[1].unique, true);
});

test("imports a foreign key added with ALTER TABLE", () => {
  const ast = parseSQL(
    `CREATE TABLE users (id SERIAL PRIMARY KEY);
     CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT);
     ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id);`,
    "postgres",
  );

  const { tables, relationships } = fromPostgres(ast);

  assert.equal(relationships.length, 1);
  const users = tables.find((table) => table.name === "users")!;
  const posts = tables.find((table) => table.name === "posts")!;

  assert.equal(relationships[0].name, "fk_posts_user_id_users");
  assert.equal(relationships[0].startTableId, posts.id);
  assert.equal(relationships[0].endTableId, users.id);
  assert.equal(relationships[0].startFieldId, posts.fields[1].id);
  assert.equal(relationships[0].endFieldId, users.fields[0].id);
});

test("resolves a foreign key that points at a table declared later", () => {
  const ast = parseSQL(
    `CREATE TABLE posts (
       id SERIAL PRIMARY KEY,
       user_id INT REFERENCES users (id)
     );
     CREATE TABLE users (id SERIAL PRIMARY KEY);`,
    "postgres",
  );

  const { tables, relationships } = fromPostgres(ast);

  assert.equal(tables.length, 2);
  assert.equal(relationships.length, 1);
  const users = tables.find((table) => table.name === "users")!;
  assert.equal(relationships[0].endTableId, users.id);
});

test("imports enums and composite types", () => {
  const ast = parseSQL(
    `CREATE TYPE status_enum AS ENUM ('active', 'inactive');
     CREATE TYPE address AS (street TEXT, zip VARCHAR(10));`,
    "postgres",
  );

  const { enums, types } = fromPostgres(ast);

  assert.equal(enums.length, 1);
  assert.equal(enums[0].name, "status_enum");
  assert.deepEqual(enums[0].values, ["active", "inactive"]);

  assert.equal(types.length, 1);
  assert.equal(types[0].name, "address");
  assert.equal(types[0].fields.length, 2);
  assert.equal(types[0].fields[0].name, "street");
  assert.equal(types[0].fields[0].type, "TEXT");
  assert.equal(types[0].fields[1].name, "zip");
  assert.equal(types[0].fields[1].type, "VARCHAR");
  assert.equal(types[0].fields[1].size, 10);
});

test("imports comments, defaults, sizes and checks", () => {
  const ast = parseSQL(
    `CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       amount NUMERIC(10,2) DEFAULT 0,
       created_at TIMESTAMP DEFAULT now(),
       age INT CHECK (age > 0)
     );
     COMMENT ON TABLE users IS 'the people';
     COMMENT ON COLUMN users.id IS 'the key';`,
    "postgres",
  );

  const { tables } = fromPostgres(ast);
  const users = tables[0];

  assert.equal(users.comment, "the people");
  assert.equal(users.fields[0].comment, "the key");
  assert.equal(users.fields[1].fieldType.type, "NUMERIC");
  assert.equal(users.fields[1].fieldType.precision, 10);
  assert.equal(users.fields[1].fieldType.scale, 2);
  assert.equal(users.fields[1].default, "0");
  assert.equal(users.fields[2].fieldType.type, "TIMESTAMP");
  assert.equal(users.fields[2].default, "now()");
  assert.equal(users.fields[3].check, '"age" > 0');
});

test("imports a single statement AST node", () => {
  const ast = parseSQL(
    "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL);",
    "postgres",
  );

  const { tables } = fromPostgres(ast[0]);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].name, "users");
});
