import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseMSSQL,
  readOnActions,
  splitMSSQLStatements,
  stripMSSQLNoise,
} from "./mssql-parser.ts";

describe("mssql-parser", () => {
  it("parses a create table statement into columns", () => {
    const ast = parseMSSQL(`
      CREATE TABLE [dbo].[users] (
        [id] INT NOT NULL IDENTITY(1,1),
        [email] NVARCHAR(255) NOT NULL,
        [age] INT NULL
      );
    `);

    assert.equal(ast.length, 1);
    assert.equal(ast[0].type, "create");
    assert.equal(ast[0].keyword, "table");
    assert.equal(ast[0].table[0].db, "dbo");
    assert.equal(ast[0].table[0].table, "users");

    const columns = ast[0].create_definitions;
    assert.equal(columns.length, 3);

    assert.equal(columns[0].column.column, "id");
    assert.equal(columns[0].definition.dataType, "INT");
    assert.equal(columns[0].nullable.type, "not null");
    assert.ok(columns[0].auto_increment);

    assert.equal(columns[1].column.column, "email");
    assert.equal(columns[1].definition.dataType, "NVARCHAR");
    assert.equal(columns[1].definition.length, 255);

    // An explicit NULL must not be treated as NOT NULL.
    assert.equal(columns[2].nullable.type, "null");
  });

  it("keeps the scale of a decimal column", () => {
    const ast = parseMSSQL(
      "CREATE TABLE t (amount DECIMAL(10, 2) NOT NULL);",
    );
    const column = ast[0].create_definitions[0];
    assert.equal(column.definition.length, 10);
    assert.equal(column.definition.scale, 2);
  });

  it("reads column defaults", () => {
    const ast = parseMSSQL(
      `CREATE TABLE t (a INT DEFAULT 0, b NVARCHAR(10) DEFAULT 'x', c INT DEFAULT NULL, d DATETIME DEFAULT GETDATE());`,
    );
    const columns = ast[0].create_definitions;

    assert.equal(columns[0].default_val.value.value, 0);
    assert.equal(columns[1].default_val.value.value, "x");
    assert.equal(columns[2].default_val.value.type, "null");
    assert.equal(columns[3].default_val.value.type, "function");
  });

  it("parses a table level primary key constraint", () => {
    const ast = parseMSSQL(`
      CREATE TABLE t (
        id INT NOT NULL,
        code VARCHAR(10),
        CONSTRAINT pk_t PRIMARY KEY (id, code)
      );
    `);
    const constraint = ast[0].create_definitions[2];
    assert.equal(constraint.resource, "constraint");
    assert.equal(constraint.constraint_type, "primary key");
    assert.equal(constraint.constraint, "pk_t");
    assert.deepEqual(
      constraint.definition.map((column: { column: string }) => column.column),
      ["id", "code"],
    );
  });

  it("parses a table level foreign key constraint with referential actions", () => {
    const ast = parseMSSQL(`
      CREATE TABLE orders (
        id INT NOT NULL,
        user_id INT,
        CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES [dbo].[users] ([id])
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    const constraint = ast[0].create_definitions[2];
    assert.equal(constraint.constraint_type, "foreign key");
    assert.equal(constraint.constraint, "fk_orders_user");
    assert.equal(constraint.definition[0].column, "user_id");
    assert.equal(constraint.reference_definition.table[0].table, "users");
    assert.equal(constraint.reference_definition.definition[0].column, "id");

    const actions = constraint.reference_definition.on_action;
    assert.equal(actions.length, 2);
    assert.equal(actions[0].type, "on delete");
    assert.equal(actions[0].value.value, "cascade");
    assert.equal(actions[1].type, "on update");
    assert.equal(actions[1].value.value, "no action");
  });

  it("parses an inline references clause", () => {
    const ast = parseMSSQL(
      "CREATE TABLE orders (id INT, user_id INT REFERENCES [dbo].[users] ([id]));",
    );
    const column = ast[0].create_definitions[1];
    assert.equal(column.reference_definition.table[0].table, "users");
    assert.equal(column.reference_definition.definition[0].column, "id");
  });

  it("parses an inline references clause without a column list", () => {
    const ast = parseMSSQL(
      "CREATE TABLE orders (id INT, user_id INT REFERENCES [dbo].[users]);",
    );
    const column = ast[0].create_definitions[1];
    assert.equal(column.reference_definition.table[0].table, "users");
    assert.deepEqual(column.reference_definition.definition, []);
  });

  it("parses a create index statement", () => {
    const ast = parseMSSQL(
      "CREATE UNIQUE INDEX ix_users_email ON [dbo].[users] ([email] ASC);",
    );
    assert.equal(ast[0].keyword, "index");
    assert.equal(ast[0].index, "ix_users_email");
    assert.equal(ast[0].index_type, "unique");
    assert.equal(ast[0].table.table, "users");
    assert.deepEqual(
      ast[0].index_columns.map((column: { column: string }) => column.column),
      ["email"],
    );
  });

  it("parses an alter table add foreign key statement", () => {
    const ast = parseMSSQL(`
      ALTER TABLE [dbo].[orders] ADD CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES [dbo].[users] ([id]);
    `);
    assert.equal(ast[0].type, "alter");
    assert.equal(ast[0].table[0].table, "orders");
    assert.equal(ast[0].expr[0].action, "add");
    assert.equal(ast[0].expr[0].create_definitions.constraint_type, "foreign key");
    assert.equal(
      ast[0].expr[0].create_definitions.reference_definition.table[0].table,
      "users",
    );
  });

  it("ignores statements that carry no diagram information", () => {
    const ast = parseMSSQL(`
      SET NOCOUNT ON;
      CREATE VIEW v_users AS SELECT * FROM users;
      CREATE PROCEDURE dbo.p AS SELECT 1;
    `);
    assert.deepEqual(ast, []);
  });

  it("strips comments and GO batch separators", () => {
    const sql = stripMSSQLNoise(`
      -- a comment
      /* a block comment */
      CREATE TABLE t (id INT);
      GO
      CREATE TABLE u (id INT);
    `);
    assert.equal(sql.includes("--"), false);
    assert.equal(sql.includes("/*"), false);
    assert.equal(/\bGO\b/.test(sql), false);
  });

  it("splits statements on semicolons outside of strings", () => {
    const statements = splitMSSQLStatements(
      "CREATE TABLE t (a VARCHAR(10) DEFAULT 'x;y'); CREATE TABLE u (id INT);",
    );
    assert.equal(statements.length, 2);
    assert.equal(statements[0].includes("'x;y'"), true);
  });

  it("reads on delete and on update actions", () => {
    const actions = readOnActions(" ON DELETE SET NULL ON UPDATE CASCADE");
    assert.equal(actions.length, 2);
    assert.equal(actions[0].value.value, "set null");
    assert.equal(actions[1].value.value, "cascade");
  });
});
