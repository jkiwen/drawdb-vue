import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { toSqlite } from "./sqlite.ts";

function makeDiagram() {
  const diagram = createEmptyDiagram({ database: "sqlite", title: "blog" });
  diagram.tables.push(
    {
      id: "users",
      name: "users",
      x: 0,
      y: 0,
      comment: "User accounts",
      fields: [
        {
          id: "uid",
          name: "id",
          type: "INTEGER",
          notNull: true,
          primary: true,
          increment: true,
        },
        {
          id: "uname",
          name: "username",
          type: "VARCHAR",
          size: 255,
          notNull: true,
          unique: true,
        },
        { id: "uem", name: "email", type: "TEXT" },
        { id: "urole", name: "role", type: "TEXT", default: "user" },
        {
          id: "ucredits",
          name: "credits",
          type: "NUMERIC",
          size: "10,2",
          default: 0,
        },
      ],
      indices: [
        { id: "idx_email", name: "idx_email", unique: false, fields: ["email"] },
      ],
      uniqueConstraints: [
        {
          id: "uc_username_email",
          name: "uc_username_email",
          fields: ["username", "email"],
        },
      ],
    },
    {
      id: "posts",
      name: "posts",
      x: 300,
      y: 0,
      fields: [
        {
          id: "pid",
          name: "id",
          type: "INTEGER",
          notNull: true,
          primary: true,
          increment: true,
        },
        {
          id: "puid",
          name: "user_id",
          type: "INTEGER",
          notNull: true,
        },
        {
          id: "ptitle",
          name: "title",
          type: "VARCHAR",
          size: 200,
          notNull: true,
        },
      ],
    },
  );
  diagram.relationships.push({
    id: "rel_user_posts",
    startTableId: "posts",
    startFieldId: "puid",
    endTableId: "users",
    endFieldId: "uid",
    cardinality: "many_to_one",
    updateConstraint: "CASCADE",
    deleteConstraint: "SET NULL",
  });
  return diagram;
}

describe("toSqlite", () => {
  it("exports CREATE TABLE statements with all field attributes", () => {
    const sql = toSqlite(makeDiagram());
    assert.match(sql, /\/\* User accounts \*\/\nCREATE TABLE IF NOT EXISTS "users"/);
    assert.match(sql, /"id" INTEGER NOT NULL/);
    assert.match(sql, /"username" VARCHAR NOT NULL UNIQUE/);
    assert.match(sql, /"email" TEXT/);
    assert.match(sql, /"role" TEXT DEFAULT 'user'/);
    assert.match(sql, /"credits" NUMERIC DEFAULT 0/);
    assert.match(sql, /PRIMARY KEY\("id"\)/);
  });

  it("exports indices and unique constraints", () => {
    const sql = toSqlite(makeDiagram());
    assert.match(
      sql,
      /CREATE INDEX IF NOT EXISTS "idx_email"\nON "users" \("email"\);/,
    );
    assert.match(
      sql,
      /CONSTRAINT "uc_username_email" UNIQUE \("username", "email"\)/,
    );
  });

  it("exports inline foreign keys", () => {
    const sql = toSqlite(makeDiagram());
    assert.match(
      sql,
      /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\)\n\tON UPDATE CASCADE ON DELETE SET NULL/,
    );
  });

  it("exports views", () => {
    const diagram = makeDiagram();
    diagram.views.push({
      id: "v1",
      name: "user_posts",
      x: 0,
      y: 0,
      baseTableId: "users",
      joins: [
        {
          id: "j1",
          type: "INNER",
          tableId: "posts",
          on: {
            leftTableId: "users",
            leftFieldId: "uid",
            rightFieldId: "puid",
          },
        },
      ],
      columns: [
        { id: "c1", tableId: "users", fieldId: "uname" },
        { id: "c2", tableId: "posts", fieldId: "ptitle", alias: "post_title" },
      ],
    });
    const sql = toSqlite(diagram);
    assert.match(sql, /CREATE VIEW IF NOT EXISTS "user_posts" AS/);
    assert.match(
      sql,
      /SELECT\n  "users"."username",\n  "posts"."title" AS "post_title"/,
    );
    assert.match(
      sql,
      /FROM "users"\nINNER JOIN "posts" ON "users"."id" = "posts"."user_id"/,
    );
  });
});
