import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { toOracleSql } from "./oraclesql.ts";

function makeDiagram() {
  const diagram = createEmptyDiagram({ database: "oraclesql", title: "blog" });
  diagram.tables.push(
    {
      id: "users",
      name: "users",
      x: 0,
      y: 0,
      logical: { id: "le-users", name: "users", attributes: [] },
      fields: [
        {
          id: "uid",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
          notNull: true,
          primary: true,
          increment: true,
          comment: "primary identifier",
        },
        {
          id: "uname",
          name: "username",
          fieldType: { type: "VARCHAR2", length: 255 },
          fieldTypeSource: "explicit",
          notNull: true,
          unique: true,
        },
        {
          id: "uem",
          name: "email",
          fieldType: { type: "VARCHAR2", length: 255 },
          fieldTypeSource: "explicit",
        },
        {
          id: "urole",
          name: "role",
          fieldType: { type: "VARCHAR2", length: 50 },
          fieldTypeSource: "explicit",
          default: "user",
        },
        {
          id: "ucredits",
          name: "credits",
          fieldType: { type: "NUMBER", precision: 10, scale: 2 },
          fieldTypeSource: "explicit",
          default: 0,
        },
        {
          id: "ucreated",
          name: "created_at",
          fieldType: { type: "TIMESTAMP" },
          fieldTypeSource: "explicit",
          default: "CURRENT_TIMESTAMP",
        },
      ],
      comment: "User accounts",
      indices: [
        { id: "idx_email", name: "idx_email", unique: false, fields: ["uem"] },
      ],
      uniqueConstraints: [
        { id: "uc_username_email", name: "uc_username_email", fields: ["uname", "uem"] },
      ],
    },
    {
      id: "posts",
      name: "posts",
      x: 300,
      y: 0,
      logical: { id: "le-posts", name: "posts", attributes: [] },
      fields: [
        {
          id: "pid",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
          notNull: true,
          primary: true,
          increment: true,
        },
        {
          id: "puid",
          name: "user_id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
          notNull: true,
        },
        {
          id: "ptitle",
          name: "title",
          fieldType: { type: "VARCHAR2", length: 200 },
          fieldTypeSource: "explicit",
          notNull: true,
        },
      ],
    },
  );
  diagram.relationships.push({
    id: "rel_user_posts",
    name: "fk_posts_users",
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

describe("toOracleSql", () => {
  it("exports CREATE TABLE statements with all field attributes", () => {
    const sql = toOracleSql(makeDiagram());
    assert.match(sql, /CREATE TABLE "users"/);
    assert.match(
      sql,
      /"id" INTEGER NOT NULL GENERATED ALWAYS AS IDENTITY,\n\t"username" VARCHAR2\(255\) NOT NULL UNIQUE/,
    );
    assert.match(sql, /PRIMARY KEY\("id"\)/);
    assert.match(sql, /"email" VARCHAR2\(255\)/);
    assert.match(sql, /"role" VARCHAR2\(50\) DEFAULT 'user'/);
    assert.match(sql, /"credits" NUMBER\(10,2\) DEFAULT 0/);
    assert.match(sql, /"created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP/);
  });

  it("exports table and field comments", () => {
    const sql = toOracleSql(makeDiagram());
    assert.match(sql, /\/\* User accounts \*\/\nCREATE TABLE "users"/);
    assert.match(sql, /\t-- primary identifier\n\t"id"/);
  });

  it("exports indices and unique constraints", () => {
    const sql = toOracleSql(makeDiagram());
    assert.match(sql, /CREATE INDEX "idx_email"\nON "users" \("email"\);/);
    assert.match(
      sql,
      /CONSTRAINT "uc_username_email" UNIQUE \("username", "email"\)/,
    );
  });

  it("exports ALTER TABLE foreign keys", () => {
    const sql = toOracleSql(makeDiagram());
    assert.match(sql, /ALTER TABLE "posts"/);
    assert.match(
      sql,
      /ADD CONSTRAINT "fk_posts_users" FOREIGN KEY \("user_id"\) REFERENCES "users" \("id"\)\nON DELETE SET NULL;/,
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
    const sql = toOracleSql(diagram);
    assert.match(sql, /CREATE OR REPLACE VIEW "user_posts" AS/);
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
