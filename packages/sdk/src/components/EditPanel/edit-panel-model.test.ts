import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, LogicalAttribute, Table } from "@drawdb/core";
import {
  buildFieldRows,
  commonText,
  fieldOverview,
  filterTypeOptions,
  physicalSpecsEqual,
  resolvePanelTarget,
  suggestPhysicalSpec,
  typeParamVisibility,
} from "./edit-panel-model.ts";
import type { SelectionSnapshot } from "./edit-panel-model.ts";

/** A selection with nothing in it. */
function noSelection(): SelectionSnapshot {
  return {
    tableIds: [],
    relationshipIds: [],
    areaIds: [],
    noteIds: [],
    fields: [],
  };
}

function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();
  const users = createTable({
    id: "t_users",
    name: "users",
    logicalName: "User",
    x: 0,
    y: 0,
  });
  users.fields = [
    { id: "f_id", name: "id", fieldType: { type: "INT" }, fieldTypeSource: "mapped" },
    {
      id: "f_name",
      name: "name",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "mapped",
    },
  ];
  users.logical.attributes = [
    { id: "a_id", name: "Identifier", logicalType: { family: "integer" }, fieldId: "f_id" },
    {
      id: "a_name",
      name: "Full name",
      logicalType: { family: "string" },
      params: { length: 100 },
      fieldId: "f_name",
    },
    { id: "a_note", name: "Note", logicalType: { family: "text" }, logicalOnly: true },
  ];
  const orders = createTable({
    id: "t_orders",
    name: "orders",
    logicalName: "Order",
    x: 400,
    y: 0,
  });
  diagram.tables = [users, orders];
  diagram.relationships = [
    {
      id: "r1",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_orders",
      endFieldId: "f_user",
    },
  ];
  diagram.logicalRelationships = [
    { id: "r1", name: "places", parentRole: "User", childRole: "Order" },
  ];
  diagram.areas = [{ id: "area1", name: "Sales", x: 0, y: 0, width: 300, height: 200 }];
  diagram.notes = [{ id: "n1", title: "memo", content: "", x: 0, y: 0 }];
  return diagram;
}

describe("resolvePanelTarget", () => {
  it("falls back to the diagram when nothing is selected", () => {
    const diagram = sampleDiagram();
    const target = resolvePanelTarget(noSelection(), diagram);
    assert.equal(target.kind, "diagram");
    assert.equal(target.kind === "diagram" ? target.diagram : null, diagram);
  });

  it("shows the table editor for a single selected table", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), tableIds: ["t_users"] },
      sampleDiagram(),
    );
    assert.equal(target.kind, "table");
    if (target.kind === "table") assert.equal(target.table.id, "t_users");
  });

  it("shows the batch editor for several selected tables", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), tableIds: ["t_users", "t_orders"] },
      sampleDiagram(),
    );
    assert.equal(target.kind, "tables");
    if (target.kind === "tables") assert.equal(target.tables.length, 2);
  });

  it("lists the parts of a mixed multi selection", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), tableIds: ["t_users"], areaIds: ["area1"] },
      sampleDiagram(),
    );
    assert.deepEqual(target, {
      kind: "mixed",
      counts: { tables: 1, relationships: 0, areas: 1, notes: 0, fields: 0 },
    });
  });

  it("shows the relationship editor with its logical counterpart", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), relationshipIds: ["r1"] },
      sampleDiagram(),
    );
    assert.equal(target.kind, "relationship");
    if (target.kind === "relationship") {
      assert.equal(target.relationship.id, "r1");
      assert.equal(target.logical?.name, "places");
    }
  });

  it("shows the relationship editor when no logical counterpart exists", () => {
    const diagram = sampleDiagram();
    diagram.relationships.push({
      id: "r2",
      startTableId: "t_orders",
      startFieldId: "f_x",
      endTableId: "t_users",
      endFieldId: "f_id",
    });
    const target = resolvePanelTarget(
      { ...noSelection(), relationshipIds: ["r2"] },
      diagram,
    );
    assert.equal(target.kind, "relationship");
    if (target.kind === "relationship") {
      assert.equal(target.logical, undefined);
    }
  });

  it("shows the area editor for a single selected area", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), areaIds: ["area1"] },
      sampleDiagram(),
    );
    assert.equal(target.kind, "area");
    if (target.kind === "area") assert.equal(target.area.name, "Sales");
  });

  it("shows the empty state for a single selected note", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), noteIds: ["n1"] },
      sampleDiagram(),
    );
    assert.deepEqual(target, { kind: "empty", reason: "note" });
  });

  it("shows the table of a single selected field with the row highlighted", () => {
    const target = resolvePanelTarget(
      { ...noSelection(), fields: [{ tableId: "t_users", fieldId: "f_name" }] },
      sampleDiagram(),
    );
    assert.equal(target.kind, "table");
    if (target.kind === "table") {
      assert.equal(target.table.id, "t_users");
      assert.equal(target.focusFieldId, "f_name");
    }
  });
});

describe("buildFieldRows", () => {
  it("pairs fields with their attributes and keeps the field order", () => {
    const rows = buildFieldRows(sampleDiagram().tables[0]!, "generic");
    assert.deepEqual(
      rows.map((row) => row.key),
      ["field:f_id", "field:f_name", "attr:a_note"],
    );
    assert.equal(rows[0]!.status, "ok");
    assert.equal(rows[1]!.status, "ok");
    assert.equal(rows[2]!.status, "logical-only");
  });

  it("flags a mapped row whose physical type diverges from the suggestion", () => {
    const table = sampleDiagram().tables[0]!;
    // integer suggests INT for the generic dialect, not BIGINT.
    table.fields[0]!.fieldType = { type: "BIGINT" };
    const rows = buildFieldRows(table, "generic");
    assert.equal(rows[0]!.status, "diverged");
    assert.deepEqual(rows[0]!.suggestion, { type: "INT" });
  });

  it("does not flag an explicit physical type as diverged", () => {
    const table = sampleDiagram().tables[0]!;
    table.fields[0]!.fieldType = { type: "BIGINT" };
    table.fields[0]!.fieldTypeSource = "explicit";
    const rows = buildFieldRows(table, "generic");
    assert.equal(rows[0]!.status, "ok");
  });

  it("flags a paired attribute without a logical name", () => {
    const table = sampleDiagram().tables[0]!;
    table.logical.attributes[0]!.name = "  ";
    const rows = buildFieldRows(table, "generic");
    assert.equal(rows[0]!.status, "missing-logical-name");
  });

  it("flags a physical field without a paired attribute", () => {
    const table = sampleDiagram().tables[0]!;
    table.logical.attributes = [];
    const rows = buildFieldRows(table, "generic");
    assert.equal(rows[0]!.status, "physical-only");
    assert.equal(rows[1]!.status, "physical-only");
  });
});

describe("suggestPhysicalSpec", () => {
  it("merges mapping, family default and attribute parameters", () => {
    const attribute: LogicalAttribute = {
      id: "a1",
      name: "Code",
      logicalType: { family: "string" },
      params: { length: 12 },
    };
    const suggestion = suggestPhysicalSpec(attribute, "generic");
    assert.equal(suggestion?.type, "VARCHAR");
    assert.equal(suggestion?.length, 12);
  });

  it("has no suggestion for a domain reference or an unknown family", () => {
    const domain: LogicalAttribute = {
      id: "a1",
      name: "Code",
      logicalType: { domainId: "money" },
    };
    assert.equal(suggestPhysicalSpec(domain, "generic"), undefined);
    const unknown: LogicalAttribute = {
      id: "a2",
      name: "X",
      logicalType: { family: "no-such-family" },
    };
    assert.equal(suggestPhysicalSpec(unknown, "generic"), undefined);
  });
});

describe("physicalSpecsEqual", () => {
  it("compares the type name case-insensitively and the parameters", () => {
    assert.ok(
      physicalSpecsEqual({ type: "VARCHAR", length: 50 }, { type: "varchar", length: 50 }),
    );
    assert.ok(
      !physicalSpecsEqual({ type: "VARCHAR", length: 50 }, { type: "VARCHAR", length: 51 }),
    );
    assert.ok(
      !physicalSpecsEqual({ type: "VARCHAR" }, { type: "VARCHAR", length: 50 }),
    );
  });
});

describe("filterTypeOptions", () => {
  it("filters the dialect whitelist incrementally, case-insensitive", () => {
    const options = filterTypeOptions("generic", "var");
    assert.ok(options.includes("VARCHAR"));
    assert.ok(!options.includes("INT"));
  });

  it("returns the whitelist for an empty query", () => {
    const options = filterTypeOptions("generic", "");
    assert.ok(options.includes("INT"));
    assert.ok(options.includes("VARCHAR"));
  });
});

describe("typeParamVisibility", () => {
  it("shows length for sized types and precision/scale for precise types", () => {
    assert.deepEqual(typeParamVisibility("generic", "VARCHAR"), {
      length: true,
      precision: false,
      scale: false,
    });
    assert.deepEqual(typeParamVisibility("generic", "DECIMAL"), {
      length: false,
      precision: true,
      scale: true,
    });
  });

  it("hides the parameters of a type the dialect does not know", () => {
    assert.deepEqual(typeParamVisibility("generic", "CITEXT"), {
      length: false,
      precision: false,
      scale: false,
    });
  });
});

describe("fieldOverview", () => {
  it("summarizes the rows as the overview bar text", () => {
    const table: Table = sampleDiagram().tables[0]!;
    const overview = fieldOverview(buildFieldRows(table, "generic"));
    assert.equal(overview.total, 3);
    assert.equal(overview.paired, 2);
    assert.equal(overview.diverged, 0);
    assert.equal(overview.text, "3 fields: 2 paired, 0 diverged");
  });
});

describe("commonText", () => {
  it("returns the shared value when every object agrees", () => {
    assert.deepEqual(commonText(["a", "a", "a"]), { value: "a", multiple: false });
    assert.deepEqual(commonText([undefined, ""]), { value: "", multiple: false });
  });

  it("reports the multiple-values marker when the objects disagree", () => {
    assert.deepEqual(commonText(["a", "b"]), { value: "", multiple: true });
    assert.deepEqual(commonText(["a", undefined]), { value: "", multiple: true });
  });
});
