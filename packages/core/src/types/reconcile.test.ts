import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LogicalAttribute } from "../models/logical.ts";
import type { PhysicalField } from "../models/physical.ts";
import type { Table } from "../models/table.ts";
import { createTable } from "../models/invariants.ts";
import {
  emptyTypeScope,
  reconcilePhysicalTypes,
  validatePhysicalType,
  type TypeScopeSnapshot,
} from "./resolve.ts";

function attribute(fieldId: string): LogicalAttribute {
  return { id: `a_${fieldId}`, name: fieldId, logicalType: { family: "string" }, fieldId };
}

function field(id: string, source: PhysicalField["fieldTypeSource"], type: string): PhysicalField {
  return { id, name: id, fieldType: { type }, fieldTypeSource: source };
}

function tableWith(fields: PhysicalField[]): Table {
  const t = createTable({ name: "T" });
  t.fields = fields;
  t.logical.attributes = fields.map((f) => attribute(f.id));
  return t;
}

describe("reconcilePhysicalTypes (spec section 4.2)", () => {
  // Diagram scope maps string -> TEXT on mysql.
  const scope: TypeScopeSnapshot = {
    ...emptyTypeScope(),
    diagram: { families: { string: { mappings: { mysql: { type: "TEXT" } } } } },
  };

  it("recomputes and writes back mapped fields", () => {
    const t = tableWith([field("f1", "mapped", "VARCHAR")]);
    const next = reconcilePhysicalTypes(t, "mysql", scope);
    assert.equal(next.fields[0]?.fieldType.type, "TEXT");
    assert.equal(next.fields[0]?.fieldTypeSource, "mapped");
  });

  it("never touches explicit fields (the user's choice wins)", () => {
    const t = tableWith([field("f1", "explicit", "CHAR")]);
    const next = reconcilePhysicalTypes(t, "mysql", scope);
    assert.equal(next.fields[0]?.fieldType.type, "CHAR");
    assert.equal(next.fields[0]?.fieldTypeSource, "explicit");
  });

  it("never touches imported fields by default", () => {
    const t = tableWith([field("f1", "imported", "VARCHAR2")]);
    const next = reconcilePhysicalTypes(t, "mysql", scope);
    assert.equal(next.fields[0]?.fieldType.type, "VARCHAR2");
    assert.equal(next.fields[0]?.fieldTypeSource, "imported");
  });

  it("does not mutate the input table", () => {
    const t = tableWith([field("f1", "mapped", "VARCHAR")]);
    reconcilePhysicalTypes(t, "mysql", scope);
    assert.equal(t.fields[0]?.fieldType.type, "VARCHAR");
  });
});

describe("validatePhysicalType (spec section 4.2: compare only, never write)", () => {
  it("reports nothing when the stored spec matches the suggestion", () => {
    const f: PhysicalField = {
      id: "f1",
      name: "name",
      fieldType: { type: "VARCHAR", length: 255 },
      fieldTypeSource: "mapped",
    };
    const diags = validatePhysicalType(attribute("f1"), f, "mysql", emptyTypeScope());
    assert.equal(diags.length, 0);
  });

  it("reports LOGICAL_PHYSICAL_DIVERGED (info) when the stored type differs", () => {
    const f: PhysicalField = {
      id: "f1",
      name: "name",
      fieldType: { type: "TEXT" },
      fieldTypeSource: "explicit",
    };
    const diags = validatePhysicalType(attribute("f1"), f, "mysql", emptyTypeScope());
    assert.ok(diags.some((d) => d.code === "LOGICAL_PHYSICAL_DIVERGED"));
    const d = diags.find((x) => x.code === "LOGICAL_PHYSICAL_DIVERGED");
    assert.equal(d?.severity, "info");
  });

  it("does not write back: the field is unchanged after validation", () => {
    const f: PhysicalField = {
      id: "f1",
      name: "name",
      fieldType: { type: "TEXT" },
      fieldTypeSource: "mapped",
    };
    validatePhysicalType(attribute("f1"), f, "mysql", emptyTypeScope());
    assert.equal(f.fieldType.type, "TEXT");
  });

  it("propagates resolution diagnostics such as UNRESOLVED_TYPE", () => {
    const a: LogicalAttribute = { id: "a1", name: "g", logicalType: { family: "unknown_family" }, fieldId: "f1" };
    const f: PhysicalField = {
      id: "f1",
      name: "g",
      fieldType: { type: "TEXT" },
      fieldTypeSource: "mapped",
    };
    const diags = validatePhysicalType(a, f, "mysql", emptyTypeScope());
    assert.ok(diags.some((d) => d.code === "UNRESOLVED_TYPE"));
  });
});
