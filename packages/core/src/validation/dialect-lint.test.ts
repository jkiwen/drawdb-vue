import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import type { Diagram } from "../models/diagram.ts";
import { createTable } from "../models/invariants.ts";
import type { LogicalAttribute } from "../models/logical.ts";
import type { PhysicalField } from "../models/physical.ts";
import type { Table } from "../models/table.ts";
import {
  emptyTypeScope,
  updateFamilyMapping,
  type TypeScopeSnapshot,
} from "../types/resolve.ts";
import { lintDialect } from "./dialect-lint.ts";

let seq = 0;
function field(
  type: string,
  extra: Partial<PhysicalField> = {},
): PhysicalField {
  seq += 1;
  return {
    id: `f${seq}`,
    name: `col_${seq}`,
    fieldType: { type },
    fieldTypeSource: "mapped",
    ...extra,
  };
}

function attrFor(f: PhysicalField, family = "string"): LogicalAttribute {
  return {
    id: `a-${f.id}`,
    name: `attr_${f.id}`,
    logicalType: { family },
    fieldId: f.id,
  };
}

function tableWith(fields: PhysicalField[], attrs?: LogicalAttribute[]): Table {
  seq += 1;
  const table = createTable({ id: `t${seq}`, name: `table_${seq}` });
  table.fields = fields;
  table.logical.attributes =
    attrs ?? fields.map((f) => attrFor(f));
  return table;
}

function diagramWith(
  database: Diagram["database"],
  tables: Table[],
): Diagram {
  const diagram = createEmptyDiagram({ database });
  diagram.tables = tables;
  return diagram;
}

function codes(diagram: Diagram, scope: TypeScopeSnapshot = emptyTypeScope()) {
  return lintDialect(diagram, scope);
}

describe("lintDialect (spec section 6)", () => {
  it("reports nothing for a clean diagram", () => {
    const f = field("VARCHAR", { fieldType: { type: "VARCHAR", length: 255 } });
    const diagram = diagramWith("mysql", [tableWith([f])]);
    assert.deepEqual(codes(diagram), []);
  });

  it("TYPE_NOT_IN_DIALECT: unknown physical type is an error (spec 6.4 hard conflict)", () => {
    const f = field("GEOGRAPHY");
    const diagram = diagramWith("mysql", [tableWith([f])]);
    const result = codes(diagram);
    const hit = result.find((d) => d.code === "TYPE_NOT_IN_DIALECT");
    assert.ok(hit);
    assert.equal(hit.severity, "error");
    assert.equal(hit.scope.fieldId, f.id);
    assert.equal(hit.scope.tableId, diagram.tables[0].id);
  });

  it("TYPE_NOT_IN_DIALECT is fixable when the logical mapping suggests a type", () => {
    const f = field("GEOGRAPHY");
    const diagram = diagramWith("mysql", [tableWith([f])]);
    const hit = codes(diagram).find((d) => d.code === "TYPE_NOT_IN_DIALECT");
    // attribute family string maps to VARCHAR(255) in mysql
    assert.equal(hit?.fixable, true);
    assert.equal(hit?.suggestion?.type, "VARCHAR");
  });

  it("TYPE_CAPABILITY_MISMATCH: increment on a non-incrementable type", () => {
    const f = field("TEXT", { increment: true, fieldTypeSource: "explicit" });
    const diagram = diagramWith("mysql", [tableWith([f])]);
    const hit = codes(diagram).find(
      (d) => d.code === "TYPE_CAPABILITY_MISMATCH",
    );
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
    assert.equal(hit.fixable, false);
  });

  it("PARAM_OUT_OF_RANGE: length on a non-sized type", () => {
    // mysql TEXT is registered as sized in this registry, so use BOOLEAN.
    const f = field("BOOLEAN", {
      fieldType: { type: "BOOLEAN", length: 100 },
      fieldTypeSource: "explicit",
    });
    const diagram = diagramWith("mysql", [tableWith([f])]);
    const hit = codes(diagram).find((d) => d.code === "PARAM_OUT_OF_RANGE");
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
    assert.equal(hit.scope.fieldId, f.id);
  });

  it("SIZE_EXCEEDS_MAX: VARCHAR(8001) exceeds the mssql limit", () => {
    const f = field("VARCHAR", {
      fieldType: { type: "VARCHAR", length: 8001 },
      fieldTypeSource: "explicit",
    });
    const diagram = diagramWith("mssql", [tableWith([f])]);
    const hit = codes(diagram).find((d) => d.code === "SIZE_EXCEEDS_MAX");
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
  });

  it("SIZE_EXCEEDS_MAX: within-limit lengths stay quiet", () => {
    // explicit: the user's choice wins, so no divergence info is raised (§4.2)
    const f = field("VARCHAR", {
      fieldType: { type: "VARCHAR", length: 8000 },
      fieldTypeSource: "explicit",
    });
    const diagram = diagramWith("mssql", [tableWith([f])]);
    assert.deepEqual(codes(diagram), []);
  });

  it("MAPPING_MISSING: a scope family without a mapping for the dialect", () => {
    let scope = emptyTypeScope();
    const reg = updateFamilyMapping(scope, "application", "geo", "postgres", {
      type: "GEOGRAPHY",
    });
    assert.ok(reg.ok);
    scope = reg.scope;
    const f = field("GEOGRAPHY");
    // attribute uses the custom "geo" family which has no mysql mapping
    const a = attrFor(f, "geo");
    const t = tableWith([f], [a]);
    const diagram = diagramWith("mysql", [t]);
    const hit = codes(diagram, scope).find(
      (d) => d.code === "MAPPING_MISSING",
    );
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
    assert.equal(hit.scope.fieldId, f.id);
  });

  it("UNRESOLVED_TYPE: an attribute referencing an unknown domain", () => {
    const f = field("VARCHAR", { fieldType: { type: "VARCHAR", length: 10 } });
    const a: LogicalAttribute = {
      id: "a-x",
      name: "amount",
      logicalType: { domainId: "NoSuchDomain" },
      fieldId: f.id,
    };
    const diagram = diagramWith("mysql", [tableWith([f], [a])]);
    const hit = codes(diagram).find((d) => d.code === "UNRESOLVED_TYPE");
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
  });

  it("LOGICAL_ONLY: an attribute without a physical field is info, never blocking", () => {
    const f = field("VARCHAR", { fieldType: { type: "VARCHAR", length: 10 } });
    const orphan: LogicalAttribute = {
      id: "a-orphan",
      name: "orphan",
      logicalType: { family: "string" },
    };
    const diagram = diagramWith("mysql", [tableWith([f], [attrFor(f), orphan])]);
    const hit = codes(diagram).find((d) => d.code === "LOGICAL_ONLY");
    assert.ok(hit);
    assert.equal(hit.severity, "info");
    assert.equal(hit.fixable, false);
  });

  it("PHYSICAL_ONLY: a field without a logical attribute is info", () => {
    const f = field("VARCHAR", { fieldType: { type: "VARCHAR", length: 10 } });
    const diagram = diagramWith("mysql", [tableWith([f], [])]);
    const hit = codes(diagram).find((d) => d.code === "PHYSICAL_ONLY");
    assert.ok(hit);
    assert.equal(hit.severity, "info");
    assert.equal(hit.scope.fieldId, f.id);
  });

  it("LOGICAL_PHYSICAL_DIVERGED: stored type differs from the suggestion (info, fixable)", () => {
    const f = field("TEXT"); // suggestion for string in mysql is VARCHAR(255)
    const diagram = diagramWith("mysql", [tableWith([f])]);
    const hit = codes(diagram).find(
      (d) => d.code === "LOGICAL_PHYSICAL_DIVERGED",
    );
    assert.ok(hit);
    assert.equal(hit.severity, "info");
    assert.equal(hit.fixable, true);
    assert.equal(hit.suggestion?.type, "VARCHAR");
  });

  it("RELATIONSHIP_NOT_IMPLEMENTED: a logical relationship without a physical FK", () => {
    const diagram = diagramWith("mysql", [tableWith([])]);
    diagram.logicalRelationships = [
      { id: "lr1", relationshipType: "many-to-many" },
    ];
    const hits = codes(diagram).filter(
      (d) => d.code === "RELATIONSHIP_NOT_IMPLEMENTED",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].severity, "warning");
    assert.equal(hits[0].scope.relationshipId, "lr1");
  });

  it("RELATIONSHIP_NOT_IMPLEMENTED: physicalPending and implemented relationships stay quiet", () => {
    const diagram = diagramWith("mysql", [tableWith([])]);
    diagram.logicalRelationships = [
      { id: "lr1", relationshipType: "many-to-many", physicalPending: true },
      { id: "r-implemented" },
    ];
    diagram.relationships.push({
      id: "r-implemented",
      startTableId: "t",
      startFieldId: "a",
      endTableId: "t",
      endFieldId: "b",
    });
    assert.deepEqual(codes(diagram), []);
  });

  it("NAME_CONFLICT: a loaded domain whose name collides with a builtin family", () => {
    const scope = emptyTypeScope();
    // simulate a legacy/corrupt snapshot that bypassed registerDomain
    scope.application.domains = {
      String: { id: "d1", name: "String", family: "text" },
    };
    const diagram = diagramWith("mysql", [tableWith([])]);
    const hit = codes(diagram, scope).find((d) => d.code === "NAME_CONFLICT");
    assert.ok(hit);
    assert.equal(hit.severity, "error");
    assert.equal(hit.scope.domainId, "d1");
  });

  it("MATERIALIZATION_UNSUPPORTED: materialized spec on a dialect that cannot materialize", () => {
    const f = field("GEO", {
      fieldType: { type: "GEO", materialized: true },
      fieldTypeSource: "explicit",
    });
    const diagram = diagramWith("mysql", [tableWith([f], [])]);
    const hit = codes(diagram).find(
      (d) => d.code === "MATERIALIZATION_UNSUPPORTED",
    );
    assert.ok(hit);
    assert.equal(hit.severity, "warning");
    assert.equal(hit.scope.fieldId, f.id);
  });

  it("aggregates diagnostics across tables", () => {
    const f1 = field("GEOGRAPHY");
    const f2 = field("TEXT", { increment: true, fieldTypeSource: "explicit" });
    const diagram = diagramWith("mysql", [
      tableWith([f1]),
      tableWith([f2]),
    ]);
    const result = codes(diagram);
    assert.ok(result.some((d) => d.code === "TYPE_NOT_IN_DIALECT"));
    assert.ok(result.some((d) => d.code === "TYPE_CAPABILITY_MISMATCH"));
  });
});
