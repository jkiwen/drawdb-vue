import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildImportSource, countDiagram } from "./source.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { exportDiagramJson } from "../serialize/export.ts";
import type { Diagram, Table } from "../models/index.ts";

/** The smallest XML Standard File the erwin reader understands. */
const ERWIN = `<?xml version="1.0" encoding="UTF-8"?>
<ERwin FileVersion="7.3.1822" Format="ERwin" xmlns="http://www.ca.com/erwin">
<EMX:Model>
  <Entity id="{E1}+00000000" name="Customer">
    <EntityProps>
      <Name>Customer</Name>
      <Physical_Name>customers</Physical_Name>
    </EntityProps>
    <Attribute id="{A1}+00000000" name="Customer id">
      <AttributeProps>
        <Name>Customer id</Name>
        <Physical_Name>customer_id</Physical_Name>
        <Physical_Data_Type>INT(4)</Physical_Data_Type>
        <Null_Option_Type>1</Null_Option_Type>
      </AttributeProps>
    </Attribute>
  </Entity>
</EMX:Model>
</ERwin>`;

function field(id: string, name: string): Table["fields"][number] {
  return { id, name, fieldType: { type: "INTEGER" }, fieldTypeSource: "mapped" };
}

function fixture(): Diagram {
  const empty = createEmptyDiagram({ database: "mysql", title: "shop" });
  empty.tables = [
    {
      id: "t1",
      name: "users",
      x: 40,
      y: 60,
      fields: [field("f1", "id"), field("f2", "email")],
      logical: { id: "l1", name: "user", attributes: [] },
      primaryKey: { id: "pk1", logicalName: "PK_user", name: "PK_users", columns: [{ fieldId: "f1" }] },
      indices: [
        { id: "i1", name: "Idx_users_email", unique: false, columns: [{ fieldId: "f2" }] },
      ],
    },
  ];
  return empty;
}

describe("buildImportSource (P8 task 1)", () => {
  it("reads a SQL script into a diagram", () => {
    const source = buildImportSource(
      "CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255));",
      { format: "sql", database: "mysql" },
    );
    assert.equal(source.format, "sql");
    assert.equal(source.issues.length, 0);
    assert.equal(source.diagram?.tables.length, 1);
    assert.equal(source.diagram?.tables[0]?.name, "users");
  });

  it("reads a DBML source into a diagram", () => {
    const source = buildImportSource("Table users {\n  id integer [pk]\n  email varchar\n}", {
      format: "dbml",
    });
    assert.equal(source.diagram?.tables.length, 1);
    assert.deepEqual(
      source.diagram?.tables[0]?.fields.map((item) => item.name),
      ["id", "email"],
    );
  });

  it("reads the JSON of a diagram and keeps its keys", () => {
    const source = buildImportSource(exportDiagramJson(fixture()), { format: "json" });
    assert.equal(source.diagram?.tables[0]?.name, "users");
    assert.equal(source.diagram?.tables[0]?.primaryKey?.name, "PK_users");
    assert.equal(source.diagram?.tables[0]?.indices?.[0]?.name, "Idx_users_email");
  });

  it("reads an erwin file and carries its report and version", () => {
    const source = buildImportSource(ERWIN, { format: "erwin", database: "generic" });
    assert.equal(source.version, "7.3.1822");
    assert.equal(source.report?.entities, 1);
    assert.equal(source.diagram?.tables[0]?.name, "customers");
    assert.equal(source.diagram?.tables[0]?.fields[0]?.fieldTypeSource, "imported");
  });

  it("keeps a parse failure as an issue instead of throwing", () => {
    const source = buildImportSource("this is not sql at all", {
      format: "sql",
      database: "mysql",
    });
    assert.equal(source.diagram, null);
    assert.equal(source.issues.length > 0, true);
    assert.equal(source.issues[0]?.level, "error");
    assert.equal(source.issues[0]?.code.length > 0, true);
  });

  it("counts what a diagram holds", () => {
    assert.deepEqual(countDiagram(fixture()), {
      tables: 1,
      fields: 2,
      keys: 2,
      relationships: 0,
      domains: 0,
      notes: 0,
      areas: 0,
    });
    assert.equal(countDiagram(null).tables, 0);
  });
});
