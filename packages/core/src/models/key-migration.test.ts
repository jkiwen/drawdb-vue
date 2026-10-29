import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { normalizeDiagramKeys, normalizeTableKeys } from "./key-migration.ts";
import { createEmptyDiagram } from "./diagram.ts";
import type { Diagram } from "./diagram.ts";
import type { Table } from "./table.ts";
import type { PhysicalField } from "./physical.ts";

/**
 * The old document shape this test pins down: the legacy members are declared
 * here, not on the public model any more.
 */
type LegacyField = PhysicalField & { primary?: boolean };
type LegacyIndex = {
  id?: string;
  logicalName?: string;
  name: string;
  unique: boolean;
  fields?: string[];
  columns?: Array<{ fieldId: string; order?: "asc" | "desc" }>;
};
type LegacyUniqueConstraint = { id?: string; name: string; fields?: string[] };
type LegacyTable = Omit<Table, "fields" | "indices" | "uniqueKeys"> & {
  fields: LegacyField[];
  indices?: LegacyIndex[];
  uniqueConstraints?: LegacyUniqueConstraint[];
};

function normalizeLegacy(table: LegacyTable): Table {
  return normalizeTableKeys(table as unknown as Table);
}

function field(id: string, name: string, primary = false): LegacyField {
  return {
    id,
    name,
    fieldType: { type: "INTEGER" },
    fieldTypeSource: "mapped",
    ...(primary ? { primary: true } : {}),
  };
}

function table(fields: LegacyField[], logicalName = "user"): LegacyTable {
  return {
    id: "t_users",
    name: "users",
    x: 0,
    y: 0,
    fields,
    logical: { id: "l_users", name: logicalName, attributes: [] },
  };
}

describe("key migration (P2' task 2)", () => {
  it("fills the columns of an index that still carries fields", () => {
    const source = {
      ...table([field("f_id", "id"), field("f_email", "email")]),
      indices: [{ name: "idx_email", unique: false, fields: ["f_email"] }],
    };

    const normalized = normalizeLegacy(source);
    const index = normalized.indices?.[0];

    assert.deepEqual(index?.columns, [{ fieldId: "f_email" }]);
    assert.equal(index?.logicalName, "Idx_user");
    assert.equal(index?.name, "idx_email", "a name that exists is kept");
    assert.ok(index?.id, "the index gets an id");
  });

  it("keeps the order and the direction of the columns it finds", () => {
    const source = {
      ...table([field("f_a", "a"), field("f_b", "b")]),
      indices: [
        {
          id: "idx_1",
          logicalName: "Idx_ab",
          name: "idx_ab",
          unique: true,
          columns: [{ fieldId: "f_b", order: "desc" as const }, { fieldId: "f_a" }],
        },
      ],
    };

    const normalized = normalizeLegacy(source);

    assert.deepEqual(normalized.indices?.[0]?.columns, [
      { fieldId: "f_b", order: "desc" },
      { fieldId: "f_a" },
    ]);
    assert.equal(normalized.indices?.[0]?.id, "idx_1");
  });

  it("turns the primary flag of the fields into a primary key", () => {
    const source = table([
      field("f_id", "id", true),
      field("f_tenant", "tenant", true),
      field("f_email", "email"),
    ]);

    const primaryKey = normalizeLegacy(source).primaryKey;

    assert.deepEqual(primaryKey?.columns, [{ fieldId: "f_id" }, { fieldId: "f_tenant" }]);
    assert.equal(primaryKey?.name, "PK_users");
    assert.equal(primaryKey?.logicalName, "PK_user");
  });

  it("declares no primary key when no field is primary", () => {
    const normalized = normalizeLegacy(table([field("f_id", "id")]));

    assert.equal(normalized.primaryKey, undefined);
  });

  it("turns every unique constraint into a unique key", () => {
    const source = {
      ...table([field("f_email", "email")]),
      uniqueConstraints: [{ id: "uq_1", name: "uq_email", fields: ["f_email"] }],
    };

    const uniqueKeys = normalizeLegacy(source).uniqueKeys;

    assert.equal(uniqueKeys?.length, 1);
    assert.deepEqual(uniqueKeys?.[0]?.columns, [{ fieldId: "f_email" }]);
    assert.equal(uniqueKeys?.[0]?.name, "uq_email");
    assert.equal(uniqueKeys?.[0]?.id, "uq_1");
  });

  it("derives the foreign keys of a diagram from its relationships", () => {
    const diagram: Diagram = createEmptyDiagram({ database: "mysql" });
    const parent = {
      ...table([field("f_id", "id")], "user"),
      id: "t_users",
      name: "users",
    };
    const child = {
      ...table([field("f_user", "user_id")], "post"),
      id: "t_posts",
      name: "posts",
    };
    diagram.tables = [parent, child] as unknown as Table[];
    diagram.relationships = [
      {
        id: "r_1",
        name: "fk_posts_user",
        startTableId: "t_posts",
        startFieldId: "f_user",
        endTableId: "t_users",
        endFieldId: "f_id",
      },
    ];

    const normalized = normalizeDiagramKeys(diagram);
    const childAfter = normalized.tables.find((entry) => entry.id === "t_posts");

    assert.equal(childAfter?.foreignKeys?.length, 1);
    assert.equal(childAfter?.foreignKeys?.[0]?.name, "fk_posts_user");
    assert.equal(childAfter?.foreignKeys?.[0]?.logicalName, "FK_post_user");
    assert.equal(childAfter?.foreignKeys?.[0]?.relationshipId, "r_1");
    assert.equal(
      normalized.tables.find((entry) => entry.id === "t_users")?.foreignKeys,
      undefined,
      "the parent side holds no foreign key of its own",
    );
  });

  it("names a key that arrives without a name", () => {
    const source = {
      ...table([field("f_email", "email")]),
      uniqueConstraints: [{ name: "", fields: ["f_email"] }],
    };

    assert.equal(normalizeLegacy(source).uniqueKeys?.[0]?.name, "UK_users");
  });

  it("is idempotent and leaves its input untouched", () => {
    const source = {
      ...table([field("f_id", "id", true), field("f_email", "email")]),
      indices: [{ name: "idx_email", unique: false, fields: ["f_email"] }],
    };
    const snapshot = JSON.parse(JSON.stringify(source));

    const once = normalizeLegacy(source);
    const twice = normalizeLegacy(once as unknown as LegacyTable);

    assert.deepEqual(twice, once);
    assert.deepEqual(source, snapshot, "the source table is not mutated");
  });
});
