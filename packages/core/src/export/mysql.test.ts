import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { toMySQL } from "./mysql.ts";

function makeDiagram() {
  const diagram = createEmptyDiagram({ database: "mysql", title: "blog" });
  diagram.tables.push(
    {
      id: "users",
      name: "users",
      x: 0,
      y: 0,
      fields: [
        {
          id: "uid",
          name: "id",
          type: "INT",
          notNull: true,
          primary: true,
          increment: true,
          unsigned: true,
        },
        {
          id: "uname",
          name: "username",
          type: "VARCHAR",
          size: 255,
          notNull: true,
          unique: true,
        },
        { id: "uem", name: "email", type: "VARCHAR", size: 255 },
        {
          id: "urole",
          name: "role",
          type: "ENUM",
          values: ["admin", "user"],
          default: "user",
        },
        {
          id: "ucredits",
          name: "credits",
          type: "DECIMAL",
          size: "10,2",
          default: 0,
        },
      ],
      comment: "User accounts",
      indices: [{ id: "idx_email", name: "idx_email", unique: false, fields: ["email"] }],
      uniqueConstraints: [
        { id: "uc_username_email", name: "uc_username_email", fields: ["username", "email"] },
      ],
    },
    {
      id: "posts",
      name: "posts",
      x: 300,
      y: 0,
      fields: [
        { id: "pid", name: "id", type: "BIGINT", notNull: true, primary: true, increment: true },
        {
          id: "puid",
          name: "user_id",
          type: "INT",
          notNull: true,
          unsigned: true,
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

describe("toMySQL", () => {
  it("exports CREATE TABLE statements with all field attributes", () => {
    const sql = toMySQL(makeDiagram());
    assert.match(sql, /CREATE TABLE IF NOT EXISTS `users`/);
    assert.match(sql, /`id` INT UNSIGNED NOT NULL AUTO_INCREMENT,\n\t`username` VARCHAR\(255\) NOT NULL UNIQUE/);
    assert.match(sql, /PRIMARY KEY\(`id`\)/);
    assert.match(sql, /`username` VARCHAR\(255\) NOT NULL UNIQUE/);
    assert.match(sql, /`email` VARCHAR\(255\)/);
    assert.match(sql, /`role` ENUM\('admin', 'user'\) DEFAULT 'user'/);
    assert.match(sql, /`credits` DECIMAL\(10,2\) DEFAULT 0/);
  });

  it("exports table comment", () => {
    const sql = toMySQL(makeDiagram());
    assert.match(sql, /COMMENT='User accounts'/);
  });

  it("exports indices", () => {
    const sql = toMySQL(makeDiagram());
    assert.match(sql, /CREATE INDEX `idx_email`\nON `users` \(`email`\);/);
  });

  it("exports unique constraints", () => {
    const sql = toMySQL(makeDiagram());
    assert.match(sql, /CONSTRAINT `uc_username_email` UNIQUE \(`username`, `email`\)/);
  });

  it("exports ALTER TABLE foreign keys", () => {
    const sql = toMySQL(makeDiagram());
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
    const sql = toMySQL(diagram);
    assert.match(sql, /CREATE OR REPLACE VIEW `user_posts` AS/);
    assert.match(sql, /SELECT\n  `users`.`username`,\n  `posts`.`title` AS `post_title`/);
    assert.match(sql, /FROM `users`\nINNER JOIN `posts` ON `users`.`id` = `posts`.`user_id`/);
  });
});
