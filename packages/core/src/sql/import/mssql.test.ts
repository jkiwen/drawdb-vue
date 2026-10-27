import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importSQL } from "./index.ts";
import { fromMSSQL } from "./mssql.ts";
import { parseMSSQL } from "./mssql-parser.ts";
import { Cardinality } from "../../models/constants.ts";

describe("fromMSSQL", () => {
  it("imports a table with its columns", () => {
    const diagram = importSQL(
      `CREATE TABLE [dbo].[users] (
         [id] INT NOT NULL IDENTITY(1,1),
         [email] NVARCHAR(255) NOT NULL
       );`,
      "mssql",
    );

    assert.equal(diagram.database, "mssql");
    assert.equal(diagram.tables.length, 1);

    const users = diagram.tables[0];
    assert.equal(users.name, "users");
    assert.equal(users.fields.length, 2);
    assert.equal(users.fields[0].name, "id");
    assert.equal(users.fields[0].fieldType.type, "INTEGER");
    assert.equal(users.fields[0].notNull, true);
    assert.equal(users.fields[0].increment, true);
    assert.equal(users.fields[1].name, "email");
    assert.equal(users.fields[1].fieldType.length, 255);
  });

  it("does not mark an explicitly nullable column as not null", () => {
    const diagram = importSQL(
      "CREATE TABLE t (id INT NOT NULL, nick VARCHAR(10) NULL);",
      "mssql",
    );
    assert.equal(diagram.tables[0].fields[0].notNull, true);
    assert.equal(diagram.tables[0].fields[1].notNull, false);
  });

  it("imports a table level primary key constraint", () => {
    const diagram = importSQL(
      `CREATE TABLE t (
         id INT NOT NULL,
         code VARCHAR(10),
         CONSTRAINT pk_t PRIMARY KEY (id)
       );`,
      "mssql",
    );
    const id = diagram.tables[0].fields.find((field) => field.name === "id");
    const code = diagram.tables[0].fields.find((field) => field.name === "code");
    assert.equal(id?.primary, true);
    assert.equal(code?.primary, false);
  });

  it("imports a table level foreign key as a relationship", () => {
    const diagram = importSQL(
      `CREATE TABLE [dbo].[users] ([id] INT NOT NULL);
       CREATE TABLE [dbo].[orders] (
         [id] INT NOT NULL,
         [user_id] INT,
         CONSTRAINT fk_orders_user FOREIGN KEY ([user_id]) REFERENCES [dbo].[users] ([id])
       );`,
      "mssql",
    );

    assert.equal(diagram.tables.length, 2);
    assert.equal(diagram.relationships.length, 1);

    const users = diagram.tables.find((table) => table.name === "users")!;
    const orders = diagram.tables.find((table) => table.name === "orders")!;
    const relationship = diagram.relationships[0];

    assert.equal(relationship.startTableId, orders.id);
    assert.equal(relationship.endTableId, users.id);
    assert.equal(relationship.name, "fk_orders_user_id_users");
    assert.equal(relationship.fields?.length, 1);
    assert.equal(
      relationship.fields?.[0].startFieldId,
      orders.fields.find((field) => field.name === "user_id")?.id,
    );
    assert.equal(
      relationship.fields?.[0].endFieldId,
      users.fields.find((field) => field.name === "id")?.id,
    );
  });

  it("imports an inline references clause as a relationship", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL);
       CREATE TABLE orders (id INT NOT NULL, user_id INT REFERENCES users (id));`,
      "mssql",
    );

    assert.equal(diagram.relationships.length, 1);
    const users = diagram.tables.find((table) => table.name === "users")!;
    const orders = diagram.tables.find((table) => table.name === "orders")!;
    assert.equal(diagram.relationships[0].startTableId, orders.id);
    assert.equal(diagram.relationships[0].endTableId, users.id);
  });

  it("falls back to the primary key when the reference has no column list", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL, PRIMARY KEY (id));
       CREATE TABLE orders (id INT NOT NULL, user_id INT REFERENCES users);`,
      "mssql",
    );

    assert.equal(diagram.relationships.length, 1);
    const users = diagram.tables.find((table) => table.name === "users")!;
    assert.equal(
      diagram.relationships[0].fields?.[0].endFieldId,
      users.fields.find((field) => field.name === "id")?.id,
    );
  });

  it("resolves a foreign key that points at a table created later", () => {
    const diagram = importSQL(
      `CREATE TABLE orders (id INT NOT NULL, user_id INT REFERENCES users (id));
       CREATE TABLE users (id INT NOT NULL);`,
      "mssql",
    );

    assert.equal(diagram.tables.length, 2);
    assert.equal(diagram.relationships.length, 1);
  });

  it("imports an alter table add foreign key as a relationship", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL);
       CREATE TABLE orders (id INT NOT NULL, user_id INT);
       ALTER TABLE [dbo].[orders] ADD CONSTRAINT fk_orders_user
         FOREIGN KEY (user_id) REFERENCES [dbo].[users] ([id]);`,
      "mssql",
    );

    assert.equal(diagram.relationships.length, 1);
    const users = diagram.tables.find((table) => table.name === "users")!;
    assert.equal(diagram.relationships[0].endTableId, users.id);
  });

  it("keeps the referential actions of a foreign key", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL);
       CREATE TABLE orders (
         id INT NOT NULL,
         user_id INT,
         CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
           ON DELETE CASCADE ON UPDATE NO ACTION
       );`,
      "mssql",
    );

    assert.equal(diagram.relationships[0].deleteConstraint, "Cascade");
    assert.equal(diagram.relationships[0].updateConstraint, "No action");
  });

  it("marks a relationship as one to one when the foreign key is unique", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL);
       CREATE TABLE profile (
         id INT NOT NULL,
         user_id INT UNIQUE,
         CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id)
       );`,
      "mssql",
    );

    assert.equal(diagram.relationships[0].cardinality, Cardinality.ONE_TO_ONE);
  });

  it("marks a relationship as many to one by default", () => {
    const diagram = importSQL(
      `CREATE TABLE users (id INT NOT NULL);
       CREATE TABLE orders (
         id INT NOT NULL,
         user_id INT,
         CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
       );`,
      "mssql",
    );

    assert.equal(diagram.relationships[0].cardinality, Cardinality.MANY_TO_ONE);
  });

  it("imports unique constraints and indices", () => {
    const diagram = importSQL(
      `CREATE TABLE users (
         id INT NOT NULL,
         email VARCHAR(255),
         CONSTRAINT uq_users_email UNIQUE (email)
       );
       CREATE UNIQUE INDEX ix_users_email ON users (email);`,
      "mssql",
    );

    const users = diagram.tables[0];
    assert.equal(users.uniqueConstraints?.length, 1);
    assert.equal(users.uniqueConstraints?.[0].name, "uq_users_email");
    assert.deepEqual(
      users.uniqueConstraints?.[0].fields.map(
        (id) => users.fields.find((f) => f.id === id)?.name,
      ),
      ["email"],
    );
    assert.equal(users.indices?.length, 1);
    assert.equal(users.indices?.[0].name, "ix_users_email");
    assert.equal(users.indices?.[0].unique, true);
    assert.deepEqual(
      users.indices?.[0].fields.map(
        (id) => users.fields.find((f) => f.id === id)?.name,
      ),
      ["email"],
    );
  });

  it("reads a composite foreign key", () => {
    const diagram = importSQL(
      `CREATE TABLE tenant (tenant_id INT NOT NULL, code VARCHAR(10), CONSTRAINT pk_tenant PRIMARY KEY (tenant_id, code));
       CREATE TABLE orders (
         id INT NOT NULL,
         tenant_id INT,
         tenant_code VARCHAR(10),
         CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id, tenant_code)
           REFERENCES tenant (tenant_id, code)
       );`,
      "mssql",
    );

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].fields?.length, 2);
  });

  it("can be called with a parsed AST", () => {
    const ast = parseMSSQL("CREATE TABLE t (id INT NOT NULL);");
    const fragment = fromMSSQL(ast);
    assert.equal(fragment.tables.length, 1);
    assert.equal(fragment.tables[0].name, "t");
    assert.equal(fragment.relationships.length, 0);
  });
});
