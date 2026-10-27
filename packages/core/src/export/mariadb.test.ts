import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { toMariadb } from "./mariadb.ts";

function makeDiagram() {
  const diagram = createEmptyDiagram({ database: "mariadb", title: "blog" });
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
          fieldType: { type: "INT" },
          fieldTypeSource: "explicit",
          notNull: true,
          primary: true,
          increment: true,
          unsigned: true,
        },
        {
          id: "uname",
          name: "username",
          fieldType: { type: "VARCHAR", length: 255 },
          fieldTypeSource: "explicit",
          notNull: true,
          unique: true,
        },
        {
          id: "uem",
          name: "email",
          fieldType: { type: "VARCHAR", length: 255 },
          fieldTypeSource: "explicit",
        },
        {
          id: "urole",
          name: "role",
          fieldType: { type: "ENUM" },
          fieldTypeSource: "explicit",
          values: ["admin", "user"],
          default: "user",
        },
        {
          id: "ucredits",
          name: "credits",
          fieldType: { type: "DECIMAL", precision: 10, scale: 2 },
          fieldTypeSource: "explicit",
          default: 0,
        },
      ],
      comment: "User accounts",
      indices: [{ id: "idx_email", name: "idx_email", unique: false, fields: ["uem"] }],
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
          fieldType: { type: "BIGINT" },
          fieldTypeSource: "explicit",
          notNull: true,
          primary: true,
          increment: true,
        },
        {
          id: "puid",
          name: "user_id",
          fieldType: { type: "INT" },
          fieldTypeSource: "explicit",
          notNull: true,
          unsigned: true,
        },
        {
          id: "ptitle",
          name: "title",
          fieldType: { type: "VARCHAR", length: 200 },
          fieldTypeSource: "explicit",
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

describe("toMariadb", () => {
  it("exports CREATE OR REPLACE TABLE statements with field attributes", () => {
    const sql = toMariadb(makeDiagram());
    assert.match(sql, /CREATE OR REPLACE TABLE `users`/);
    assert.match(sql, /`id` INT UNSIGNED NOT NULL AUTO_INCREMENT/);
    assert.match(sql, /PRIMARY KEY\(`id`\)/);
    assert.match(sql, /`username` VARCHAR\(255\) NOT NULL UNIQUE/);
    assert.match(sql, /`email` VARCHAR\(255\)/);
    assert.match(sql, /`role` ENUM\('admin', 'user'\) DEFAULT 'user'/);
    assert.match(sql, /`credits` DECIMAL\(10,2\) DEFAULT 0/);
  });

  it("exports table comment", () => {
    const sql = toMariadb(makeDiagram());
    assert.match(sql, /COMMENT='User accounts'/);
  });

  it("exports indices and unique constraints", () => {
    const sql = toMariadb(makeDiagram());
    assert.match(sql, /CREATE INDEX `idx_email`\nON `users` \(`email`\);/);
    assert.match(sql, /CONSTRAINT `uc_username_email` UNIQUE \(`username`, `email`\)/);
  });

  it("exports ALTER TABLE foreign keys", () => {
    const sql = toMariadb(makeDiagram());
    assert.match(sql, /ALTER TABLE `posts`/);
    assert.match(
      sql,
      /ADD FOREIGN KEY\(`user_id`\) REFERENCES `users`\(`id`\)\nON UPDATE CASCADE ON DELETE SET NULL;/,
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
    const sql = toMariadb(diagram);
    assert.match(sql, /CREATE OR REPLACE VIEW `user_posts` AS/);
    assert.match(sql, /SELECT\n  `users`.`username`,\n  `posts`.`title` AS `post_title`/);
    assert.match(sql, /FROM `users`\nINNER JOIN `posts` ON `users`.`id` = `posts`.`user_id`/);
  });
});
