import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { toGeneric } from "./generic.ts";
import { toMySQL } from "./mysql.ts";
import { toPostgres } from "./postgres.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Table } from "../models/table.ts";

function field(id: string, name: string, extra: Partial<Table["fields"][number]> = {}): Table["fields"][number] {
  return { id, name, fieldType: { type: "INTEGER" }, fieldTypeSource: "mapped", ...extra };
}

function diagram(database: "generic" | "mysql" | "postgres", extra: Partial<Table> = {}): Diagram {
  const empty = createEmptyDiagram({ database });
  empty.tables = [
    {
      id: "t_users",
      name: "users",
      x: 0,
      y: 0,
      fields: [field("f_id", "id"), field("f_email", "email")],
      logical: { id: "l_users", name: "user", attributes: [] },
      ...extra,
    },
  ];
  return empty;
}

describe("the exporters print the names of the keys (P2' task 5)", () => {
  it("prints a named primary key where a name is known", () => {
    const target = diagram("generic", {
      primaryKey: { id: "p1", name: "PK_users", logicalName: "PK_user", columns: [{ fieldId: "f_id" }] },
    });

    assert.match(toGeneric(target), /CONSTRAINT "PK_users" PRIMARY KEY\("id"\)/);
  });

  it("prints a primary key that carries no name without a CONSTRAINT", () => {
    const target = diagram("generic", {
      primaryKey: {
        id: "p1",
        name: "",
        logicalName: "",
        columns: [{ fieldId: "f_id" }],
      },
    });

    assert.match(toGeneric(target), /PRIMARY KEY\("id"\)/);
    assert.doesNotMatch(toGeneric(target), /CONSTRAINT/);
  });

  it("prints the name in the dialect of the diagram", () => {
    const target = diagram("mysql", {
      primaryKey: { id: "p1", name: "PK_users", logicalName: "PK_user", columns: [{ fieldId: "f_id" }] },
    });

    assert.match(toMySQL(target), /CONSTRAINT `PK_users` PRIMARY KEY\(`id`\)/);
  });

  it("prints named unique keys from the objects, not only from the old list", () => {
    const target = diagram("postgres", {
      uniqueKeys: [
        { id: "u1", name: "UK_email", logicalName: "UK_email", columns: [{ fieldId: "f_email" }] },
      ],
    });

    assert.match(toPostgres(target), /CONSTRAINT "UK_email" UNIQUE \("email"\)/);
  });

  it("prints each unique key once", () => {
    const target = diagram("generic", {
      uniqueKeys: [{ id: "u1", name: "UK_email", logicalName: "UK_email", columns: [{ fieldId: "f_email" }] }],
    });

    const sql = toGeneric(target);
    assert.equal(sql.match(/UK_email/g)?.length, 1);
    assert.match(sql, /CONSTRAINT "UK_email" UNIQUE \("email"\)/);
  });
});
