import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import { exportDiagramJson } from "./export.ts";
import { importDiagramJson } from "./import.ts";
import { ImportError } from "./types.ts";

/** A diagram with two tables, one relationship and every collection. */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram({ database: "mysql", title: "Shop" });
  diagram.sqlHeader = "-- a header";
  diagram.tables = [
    {
      id: "t1",
      name: "users",
      x: 0,
      y: 0,
      logical: { id: "le-t1", name: "users", attributes: [] },
      fields: [
        {
          id: "f1",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
        },
        {
          id: "f2",
          name: "name",
          fieldType: { type: "VARCHAR" },
          fieldTypeSource: "explicit",
        },
      ],
      primaryKey: {
        id: "pk-t1",
        name: "PK_users",
        logicalName: "PK_users",
        columns: [{ fieldId: "f1" }],
      },
    },
    {
      id: "t2",
      name: "posts",
      x: 300,
      y: 0,
      logical: { id: "le-t2", name: "posts", attributes: [] },
      fields: [
        {
          id: "f3",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
        },
        {
          id: "f4",
          name: "user_id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
        },
      ],
      primaryKey: {
        id: "pk-t2",
        name: "PK_posts",
        logicalName: "PK_posts",
        columns: [{ fieldId: "f3" }],
      },
    },
  ];
  diagram.relationships = [
    {
      id: "r1",
      name: "fk_posts_user",
      startTableId: "t2",
      startFieldId: "f4",
      endTableId: "t1",
      endFieldId: "f1",
    },
  ];
  diagram.notes = [{ id: "n1", x: 0, y: 200, title: "Note", content: "Text" }];
  diagram.subjectAreas = [
    {
      id: "a1",
      name: "Area",
      description: "The tables of the area",
      x: 0,
      y: 300,
      width: 200,
      height: 100,
    },
  ];
  diagram.types = [
    {
      id: "ty1",
      name: "address",
      fields: [{ id: "tf1", name: "street", type: "VARCHAR" }],
    },
  ];
  diagram.enums = [{ id: "e1", name: "status", values: ["active", "inactive"] }];
  diagram.views = [
    { id: "v1", name: "active_users", x: 500, y: 0, baseTableId: "t1" },
  ];
  return diagram;
}

/** Asserts that the call throws an ImportError with the code. */
function assertImportError(code: string, run: () => unknown): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ImportError, `expected an ImportError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

test("serialize: round trips a diagram", () => {
  const diagram = sampleDiagram();

  const restored = importDiagramJson(exportDiagramJson(diagram));

  assert.deepEqual(
    restored.tables.map((table) => table.name),
    ["users", "posts"],
  );
  assert.deepEqual(
    restored.tables[0].fields.map((field) => field.name),
    ["id", "name"],
  );
  assert.equal(restored.relationships.length, 1);
  assert.equal(restored.relationships[0].startTableId, "t2");
  assert.equal(restored.relationships[0].endFieldId, "f1");
  assert.equal(restored.notes.length, 1);
  assert.equal(restored.subjectAreas.length, 1);
  assert.equal(
    restored.subjectAreas[0].description,
    "The tables of the area",
  );
  assert.equal(restored.types.length, 1);
  assert.equal(restored.enums.length, 1);
  assert.equal(restored.views.length, 1);
});

test("serialize: round trips the collapse of an area", () => {
  const diagram = sampleDiagram();
  diagram.subjectAreas[0].collapsed = true;

  const restored = importDiagramJson(exportDiagramJson(diagram));

  assert.equal(restored.subjectAreas[0].collapsed, true);
});

test("serialize: exports compact json by default", () => {
  const json = exportDiagramJson(sampleDiagram());

  assert.equal(json.includes("\n"), false);
});

test("serialize: exports pretty json on request", () => {
  const json = exportDiagramJson(sampleDiagram(), { pretty: true });

  assert.equal(json.includes("\n"), true);
});

test("serialize: imports the legacy ddb field names", () => {
  const legacy = {
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
      },
    ],
    references: [
      {
        id: "r1",
        startTableId: "t1",
        startFieldId: "f1",
        endTableId: "t1",
        endFieldId: "f1",
      },
    ],
    areas: [{ id: "a1", name: "Area", x: 0, y: 0, width: 10, height: 10 }],
  };

  const diagram = importDiagramJson(legacy);

  assert.equal(diagram.relationships.length, 1);
  assert.equal(diagram.subjectAreas.length, 1);
  assert.equal(diagram.subjectAreas[0].name, "Area");
});

test("serialize: throws an ImportError for invalid json", () => {
  assertImportError("json.parse_failed", () => importDiagramJson("{"));
});

test("serialize: throws an ImportError when the tables are missing", () => {
  assertImportError("json.invalid_shape", () => importDiagramJson({}));
  assertImportError("json.invalid_shape", () =>
    importDiagramJson({ tables: "not an array" }),
  );
});

test("serialize: throws an ImportError when a relationship table is missing", () => {
  const source = {
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
      },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "t2",
        startFieldId: "f1",
        endTableId: "t1",
        endFieldId: "f1",
      },
    ],
  };

  assertImportError("relationship.missing_table", () =>
    importDiagramJson(source),
  );
});

test("serialize: throws an ImportError when a relationship field is missing", () => {
  const source = {
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
      },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "t1",
        startFieldId: "f9",
        endTableId: "t1",
        endFieldId: "f1",
      },
    ],
  };

  assertImportError("relationship.missing_field", () =>
    importDiagramJson(source),
  );
});

test("serialize: throws an ImportError when the database does not match", () => {
  const source = exportDiagramJson(sampleDiagram());

  assertImportError("database.mismatch", () =>
    importDiagramJson(source, { database: "postgres" }),
  );
});

test("serialize: accepts a mismatching database when the override is allowed", () => {
  const source = exportDiagramJson(sampleDiagram());

  const diagram = importDiagramJson(source, {
    database: "postgres",
    allowDatabaseOverride: true,
  });

  assert.equal(diagram.database, "mysql");
});

test("serialize: defaults the database to generic", () => {
  const diagram = importDiagramJson({ tables: [] });

  assert.equal(diagram.database, "generic");
});

test("serialize: defaults the missing collections to empty arrays", () => {
  const diagram = importDiagramJson({ tables: [] });

  assert.deepEqual(diagram.relationships, []);
  assert.deepEqual(diagram.notes, []);
  assert.deepEqual(diagram.subjectAreas, []);
  assert.deepEqual(diagram.types, []);
  assert.deepEqual(diagram.enums, []);
  assert.deepEqual(diagram.views, []);
});

test("serialize: does not modify the imported source object", () => {
  const source = {
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
      },
    ],
  };
  const before = JSON.stringify(source);

  importDiagramJson(source);

  assert.equal(JSON.stringify(source), before);
});

test("serialize: keeps the sql header and the title", () => {
  const diagram = importDiagramJson(exportDiagramJson(sampleDiagram()));

  assert.equal(diagram.title, "Shop");
  assert.equal(diagram.sqlHeader, "-- a header");
});

test("serialize: reports the diagnostics of a parse failure", () => {
  try {
    importDiagramJson("{");
    assert.fail("the import should have thrown");
  } catch (error) {
    assert.ok(error instanceof ImportError);
    assert.equal(error.diagnostics.length >= 1, true);
    assert.equal(typeof error.diagnostics[0].message, "string");
  }
});
