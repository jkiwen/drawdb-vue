import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PhysicalField } from "./physical.ts";
import type { LogicalAttribute, LogicalEntity } from "./logical.ts";
import type { Table } from "./table.ts";
import type { Diagram } from "./diagram.ts";
import { createEmptyDiagram } from "./diagram.ts";
import type { LogicalRelationship } from "./logical-relationship.ts";
import {
  buildAttributeIndex,
  createTable,
  removeFieldAtomic,
  validateRelationshipInvariants,
  validateTableInvariants,
} from "./invariants.ts";

function field(id: string, name: string): PhysicalField {
  return {
    id,
    name,
    fieldType: { type: "INTEGER" },
    fieldTypeSource: "mapped",
  };
}

function attribute(
  id: string,
  name: string,
  fieldId?: string,
): LogicalAttribute {
  return {
    id,
    name,
    logicalType: { family: "integer" },
    ...(fieldId !== undefined ? { fieldId } : {}),
  };
}

function entity(id: string, attributes: LogicalAttribute[]): LogicalEntity {
  return { id, name: "Entity", attributes };
}

function table(parts: {
  fields: PhysicalField[];
  attributes: LogicalAttribute[];
  logical?: LogicalEntity | null;
}): Table {
  const t: Table = {
    id: "t1",
    name: "T",
    x: 0,
    y: 0,
    fields: parts.fields,
    logical:
      parts.logical === null
        ? (undefined as unknown as LogicalEntity)
        : (parts.logical ?? entity("e1", parts.attributes)),
  };
  return t;
}

describe("INV-1 attribute.fieldId must reference a field of the same table", () => {
  it("accepts a link to an existing field", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [attribute("a1", "id", "f1")],
    });
    assert.equal(
      validateTableInvariants(t).filter((v) => v.code === "INV-1").length,
      0,
    );
  });

  it("reports a dangling fieldId", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [attribute("a1", "id", "missing")],
    });
    const violations = validateTableInvariants(t);
    assert.ok(violations.some((v) => v.code === "INV-1"));
  });
});

describe("INV-2 ids are unique within a table", () => {
  it("accepts unique ids", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "name")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "name", "f2"),
      ],
    });
    assert.equal(
      validateTableInvariants(t).filter((v) => v.code === "INV-2").length,
      0,
    );
  });

  it("reports duplicated field ids", () => {
    const t = table({
      fields: [field("f1", "id"), field("f1", "id2")],
      attributes: [attribute("a1", "id", "f1")],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-2"),
    );
  });

  it("reports duplicated attribute ids", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a1", "id2", "f1"),
      ],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-2"),
    );
  });
});

describe("INV-3 names are unique within a table", () => {
  it("reports duplicated field names", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "id")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "id2", "f2"),
      ],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-3"),
    );
  });

  it("reports duplicated attribute names", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "id2")],
      attributes: [attribute("a1", "id", "f1"), attribute("a2", "id", "f2")],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-3"),
    );
  });
});

describe("INV-4 every field pairs with exactly one attribute and vice versa", () => {
  it("accepts a fully paired table", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "name")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "name", "f2"),
      ],
    });
    assert.equal(validateTableInvariants(t).length, 0);
  });

  it("reports a field without an attribute", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-4"),
    );
  });

  it("reports an attribute without a field", () => {
    const t = table({
      fields: [],
      attributes: [attribute("a1", "id")],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-4"),
    );
  });

  it("reports two attributes pointing at the same field", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "id2", "f1"),
      ],
    });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-4"),
    );
  });

  it("exempts explicit physicalOnly / logicalOnly asymmetry markers (Q14)", () => {
    const physicalOnly: PhysicalField = { ...field("f1", "id"), physicalOnly: true };
    const logicalOnly: LogicalAttribute = {
      ...attribute("a1", "id"),
      logicalOnly: true,
    };
    const t = table({
      fields: [physicalOnly],
      attributes: [logicalOnly],
    });
    assert.equal(
      validateTableInvariants(t).filter((v) => v.code === "INV-4").length,
      0,
    );
  });
});

describe("INV-5 divergent logical/physical types on a pair are legal", () => {
  it("reports nothing when a paired field uses a hand-set physical type", () => {
    const f: PhysicalField = {
      ...field("f1", "id"),
      fieldType: { type: "VARCHAR", length: 10 },
      fieldTypeSource: "explicit",
    };
    const t = table({
      fields: [f],
      attributes: [attribute("a1", "id", "f1")],
    });
    assert.equal(validateTableInvariants(t).length, 0);
  });
});

describe("INV-6 every logical relationship pairs with one physical relationship", () => {
  function diagramWith(
    logical: LogicalRelationship[],
    physicalIds: string[],
  ): Diagram {
    const d = createEmptyDiagram();
    d.logicalRelationships = logical;
    d.relationships = physicalIds.map((id) => ({
      id,
      startTableId: "t1",
      startFieldId: "f1",
      endTableId: "t2",
      endFieldId: "f2",
    }));
    return d;
  }

  it("accepts a logical relationship with a matching physical one", () => {
    const d = diagramWith([{ id: "r1" }], ["r1"]);
    assert.equal(validateRelationshipInvariants(d).length, 0);
  });

  it("reports a logical relationship without a physical implementation", () => {
    const d = diagramWith([{ id: "r1" }], []);
    assert.ok(
      validateRelationshipInvariants(d).some((v) => v.code === "INV-6"),
    );
  });

  it("exempts logical relationships explicitly marked physicalPending", () => {
    const d = diagramWith([{ id: "r1", physicalPending: true }], []);
    assert.equal(validateRelationshipInvariants(d).length, 0);
  });
});

describe("INV-7 every physical table embeds exactly one logical entity", () => {
  it("reports a table without a logical entity (legacy data)", () => {
    const t = table({ fields: [], attributes: [], logical: null });
    assert.ok(
      validateTableInvariants(t).some((v) => v.code === "INV-7"),
    );
  });

  it("createTable always embeds a logical entity", () => {
    const t = createTable({ name: "Orders", logicalName: "Order" });
    assert.ok(t.logical);
    assert.equal(t.logical.name, "Order");
    assert.equal(validateTableInvariants(t).length, 0);
  });

  it("createTable defaults the logical name to the physical name", () => {
    const t = createTable({ name: "orders" });
    assert.equal(t.logical.name, "orders");
  });
});

describe("cross-layer atomic delete (spec section 3.5.2)", () => {
  it("removeFieldAtomic removes the field and its attribute in one step", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "name")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "name", "f2"),
      ],
    });
    t.indices = [{ name: "idx", unique: false, fields: ["f1", "f2"] }];
    const next = removeFieldAtomic(t, "f1");
    assert.equal(next.fields.length, 1);
    assert.equal(next.logical.attributes.length, 1);
    assert.deepEqual(next.indices?.[0]?.fields, ["f2"]);
    assert.equal(validateTableInvariants(next).length, 0);
  });

  it("keeps the original table untouched (immutable update)", () => {
    const t = table({
      fields: [field("f1", "id")],
      attributes: [attribute("a1", "id", "f1")],
    });
    removeFieldAtomic(t, "f1");
    assert.equal(t.fields.length, 1);
    assert.equal(t.logical.attributes.length, 1);
  });
});

describe("buildAttributeIndex", () => {
  it("maps fieldId to its attribute for O(1) pairing checks", () => {
    const t = table({
      fields: [field("f1", "id"), field("f2", "name")],
      attributes: [
        attribute("a1", "id", "f1"),
        attribute("a2", "name", "f2"),
      ],
    });
    const index = buildAttributeIndex(t);
    assert.equal(index.get("f1")?.id, "a1");
    assert.equal(index.get("f2")?.id, "a2");
    assert.equal(index.get("missing"), undefined);
  });
});
