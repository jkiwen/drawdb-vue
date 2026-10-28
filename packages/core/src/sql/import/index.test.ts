import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importSQL } from "./index.ts";

describe("importSQL", () => {
  it("imports a mysql create table statement", () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255));`;
    const diagram = importSQL(sql, "mysql");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
    assert.equal(diagram.tables[0].fields.length, 2);
    assert.equal(diagram.tables[0].fields[0].name, "id");
    assert.equal(diagram.tables[0].fields[0].primary, true);
    assert.equal(diagram.tables[0].fields[0].increment, true);
    assert.equal(diagram.tables[0].fields[1].name, "name");
    assert.equal(diagram.tables[0].fields[1].fieldType.type, "VARCHAR");
    assert.equal(diagram.tables[0].fields[1].fieldType.length, 255);
  });

  it("returns a diagram with the requested database", () => {
    const diagram = importSQL("CREATE TABLE a (id INT);", "postgres");
    assert.equal(diagram.database, "postgres");
    assert.equal(diagram.relationships.length, 0);
    assert.ok(diagram.id);
  });

  it("imports an inline foreign key as a relationship", () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (
        id INT PRIMARY KEY,
        user_id INT,
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    const diagram = importSQL(sql, "mysql");

    assert.equal(diagram.tables.length, 2);
    assert.equal(diagram.relationships.length, 1);

    const relationship = diagram.relationships[0];
    const users = diagram.tables.find((t) => t.name === "users")!;
    const posts = diagram.tables.find((t) => t.name === "posts")!;

    assert.equal(relationship.startTableId, posts.id);
    assert.equal(relationship.endTableId, users.id);
    assert.equal(relationship.deleteConstraint, "Cascade");
  });

  it("imports an alter table add foreign key as a relationship", () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (id INT PRIMARY KEY, user_id INT);
      ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id);
    `;
    const diagram = importSQL(sql, "mysql");

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].name, "fk_posts_user_id_users");
  });

  it("imports indices and unique constraints", () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(255),
        CONSTRAINT uq_email UNIQUE (email)
      );
      CREATE INDEX idx_email ON users (email);
    `;
    const diagram = importSQL(sql, "mysql");
    const users = diagram.tables[0];

    assert.equal(users.indices?.length, 1);
    assert.equal(users.indices?.[0].name, "idx_email");
    assert.deepEqual(
      users.indices?.[0].fields.map(
        (id) => users.fields.find((f) => f.id === id)?.name,
      ),
      ["email"],
    );
    assert.equal(users.uniqueConstraints?.length, 1);
    assert.equal(users.uniqueConstraints?.[0].name, "uq_email");
  });

  it("imports a postgres create table statement", () => {
    const sql = `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL);`;
    const diagram = importSQL(sql, "postgres");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
    assert.equal(diagram.tables[0].fields[0].primary, true);
    assert.equal(diagram.tables[0].fields[1].notNull, true);
  });

  it("imports a sqlite create table statement", () => {
    const sql = `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);`;
    const diagram = importSQL(sql, "sqlite");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].fields[0].fieldType.type, "INTEGER");
    assert.equal(diagram.tables[0].fields[1].fieldType.type, "TEXT");
  });

  it("imports a mariadb create table statement", () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255));`;
    const diagram = importSQL(sql, "mariadb");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].fields[0].increment, true);
  });

  it("imports an mssql create table statement", () => {
    const sql = `CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255));`;
    const diagram = importSQL(sql, "mssql");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
  });

  it("imports an oraclesql create table statement", () => {
    const sql = `CREATE TABLE users (id NUMBER(10) PRIMARY KEY, name VARCHAR2(255));`;
    const diagram = importSQL(sql, "oraclesql");

    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].fields[0].name, "id");
  });

  it("lays out imported tables so they do not overlap", () => {
    const sql = `
      CREATE TABLE a (id INT);
      CREATE TABLE b (id INT);
      CREATE TABLE c (id INT);
    `;
    const diagram = importSQL(sql, "mysql");
    const positions = diagram.tables.map((t) => `${t.x}:${t.y}`);

    assert.equal(new Set(positions).size, positions.length);
  });

  it("throws a clear error for invalid SQL", () => {
    assert.throws(
      () => importSQL("THIS IS NOT SQL", "mysql"),
      /failed to parse/i,
    );
  });

  it("throws a clear error for an unsupported database", () => {
    assert.throws(
      () => importSQL("CREATE TABLE a (id INT);", "oracle" as never),
      /unsupported/i,
    );
  });

  it("returns an empty diagram for empty SQL", () => {
    const diagram = importSQL("", "mysql");
    assert.equal(diagram.tables.length, 0);
    assert.equal(diagram.relationships.length, 0);
  });
});
