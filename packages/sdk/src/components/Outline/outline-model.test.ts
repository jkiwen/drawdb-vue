import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";
import {
  buildOutlineTree,
  flattenOutlineTree,
  outlineBranchIds,
  outlineNodePath,
  windowOutlineRows,
  type OutlineNode,
} from "./outline-model.ts";

/**
 * The pure derivation of the outline tree (plan Task 2): the hierarchy, the
 * per-layer naming, the Q15 hiding of the physical-only categories, the
 * fuzzy filter and the sort modes. The component only renders what these
 * functions return.
 */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();

  const users = createTable({
    id: "t_users",
    name: "users",
    logicalName: "User",
    x: 10,
    y: 10,
  });
  users.fields = [
    {
      id: "f_id",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "explicit",
    },
    {
      id: "f_name",
      name: "user_name",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "explicit",
    },
  ];
  users.logical.attributes = [
    {
      id: "a_id",
      name: "Identifier",
      logicalType: { family: "number" },
      fieldId: "f_id",
    },
    {
      id: "a_name",
      name: "User Name",
      logicalType: { family: "string" },
      fieldId: "f_name",
    },
  ];

  const orders = createTable({
    id: "t_orders",
    name: "orders",
    logicalName: "Order",
    x: 1000,
    y: 1000,
  });
  orders.fields = [
    {
      id: "f_oid",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "explicit",
    },
  ];

  diagram.tables = [users, orders];
  diagram.relationships = [
    {
      id: "r1",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_orders",
      endFieldId: "f_oid",
      name: "fk_orders_users",
    },
    {
      id: "r2",
      startTableId: "t_users",
      startFieldId: "f_id",
      endTableId: "t_users",
      endFieldId: "f_id",
    },
  ];
  diagram.logicalRelationships = [{ id: "r1", name: "places" }];
  diagram.notes = [{ id: "n1", x: 0, y: 0, title: "Glossary", content: "..." }];
  diagram.subjectAreas = [
    { id: "area1", name: "Sales", x: 0, y: 0, width: 500, height: 500 },
  ];
  diagram.views = [{ id: "v1", name: "active_users", x: 0, y: 0 }];
  diagram.enums = [{ id: "e1", name: "status", values: ["on", "off"] }];
  diagram.types = [{ id: "ct1", name: "address", fields: [] }];
  return diagram;
}

function category(tree: OutlineNode[], id: string): OutlineNode {
  const node = tree.find((item) => item.id === id);
  assert.ok(node, `category ${id} was not rendered`);
  return node;
}

describe("buildOutlineTree", () => {
  it("builds the category hierarchy in the fixed order", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    assert.deepEqual(
      tree.map((node) => node.id),
      [
        "cat:tables",
        "cat:relationships",
        "cat:areas",
        "cat:notes",
        "cat:views",
        "cat:enums",
        "cat:types",
      ],
    );
  });

  it("nests the fields under their table and counts the first level", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const tables = category(tree, "cat:tables");
    assert.equal(tables.count, 2);
    assert.equal(tables.children.length, 2);
    const users = tables.children[0];
    assert.equal(users.id, "table:t_users");
    assert.equal(users.label, "users");
    assert.deepEqual(
      users.children.map((field) => field.label),
      ["id", "user_name"],
    );
    assert.equal(category(tree, "cat:relationships").count, 2);
    assert.equal(category(tree, "cat:notes").count, 1);
  });

  it("switches the labels with the view layer and keeps the other as tooltip", () => {
    const physical = buildOutlineTree(sampleDiagram(), "physical");
    const usersPhysical = category(physical, "cat:tables").children[0];
    assert.equal(usersPhysical.label, "users");
    assert.equal(usersPhysical.altLabel, "User");
    assert.equal(usersPhysical.children[1].label, "user_name");
    assert.equal(usersPhysical.children[1].altLabel, "User Name");

    const logical = buildOutlineTree(sampleDiagram(), "logical");
    const usersLogical = category(logical, "cat:tables").children[0];
    assert.equal(usersLogical.label, "User");
    assert.equal(usersLogical.altLabel, "users");
    assert.deepEqual(
      usersLogical.children.map((field) => field.label),
      ["Identifier", "User Name"],
    );
    assert.equal(usersLogical.children[0].altLabel, "id");
  });

  it("hides the physical-only categories in the logical view (Q15)", () => {
    const logical = buildOutlineTree(sampleDiagram(), "logical");
    assert.deepEqual(
      logical.map((node) => node.id),
      ["cat:tables", "cat:relationships", "cat:areas", "cat:notes"],
    );
  });

  it("names the relationships per layer with a table-pair fallback", () => {
    const physical = buildOutlineTree(sampleDiagram(), "physical");
    const relationships = category(physical, "cat:relationships");
    assert.equal(relationships.children[0].label, "fk_orders_users");
    assert.equal(relationships.children[0].altLabel, "places");
    // An unnamed relationship falls back to the pair of its tables.
    assert.equal(relationships.children[1].label, "users → users");

    const logical = buildOutlineTree(sampleDiagram(), "logical");
    const logicalRelationships = category(logical, "cat:relationships");
    // A relationship always shows its own name, whichever layer the tree is
    // in; the logical name stays available as the secondary label.
    assert.equal(logicalRelationships.children[0].label, "fk_orders_users");
    assert.equal(logicalRelationships.children[0].altLabel, "places");
    assert.equal(logicalRelationships.children[1].label, "User → User");
  });

  it("nests the tables an area holds under the area", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const areas = category(tree, "cat:areas");
    assert.equal(areas.count, 1);
    const sales = areas.children[0];
    assert.equal(sales.label, "Sales");
    assert.deepEqual(
      sales.children.map((table) => table.id),
      ["area-table:area1:t_users"],
    );
  });

  it("matches the filter against both layer names and keeps the parent of a hit field", () => {
    // "Identifier" is a logical attribute name only; the physical view still
    // finds the field and brings its table along.
    const tree = buildOutlineTree(sampleDiagram(), "physical", "identifier");
    assert.deepEqual(
      tree.map((node) => node.id),
      ["cat:tables"],
    );
    const tables = tree[0];
    assert.equal(tables.count, 1);
    const users = tables.children[0];
    assert.equal(users.id, "table:t_users");
    assert.deepEqual(
      users.children.map((field) => field.id),
      ["field:t_users:f_id"],
    );
    assert.equal(users.children[0].matched, true);
    assert.equal(users.matched, false);
  });

  it("keeps every field of a table whose own name matches", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical", "users");
    const tables = category(tree, "cat:tables");
    assert.equal(tables.children.length, 1);
    assert.equal(tables.children[0].children.length, 2);
    assert.equal(tables.children[0].matched, true);
  });

  it("drops the categories without a match and reports an empty result", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical", "zzz-nothing");
    assert.deepEqual(tree, []);
  });

  it("sorts by name on demand and keeps the creation order otherwise", () => {
    const created = buildOutlineTree(sampleDiagram(), "physical", "", "created");
    assert.deepEqual(
      category(created, "cat:tables").children.map((node) => node.label),
      ["users", "orders"],
    );
    const byName = buildOutlineTree(sampleDiagram(), "physical", "", "name");
    assert.deepEqual(
      category(byName, "cat:tables").children.map((node) => node.label),
      ["orders", "users"],
    );
    // The fields sort inside their table too.
    assert.deepEqual(
      category(byName, "cat:tables").children[1].children.map((n) => n.label),
      ["id", "user_name"],
    );
  });

  it("keeps the empty categories with a zero count when no filter is active", () => {
    const empty = createEmptyDiagram();
    const tree = buildOutlineTree(empty, "physical");
    assert.ok(tree.length > 0);
    assert.ok(tree.every((node) => node.count === 0));
  });
});

describe("flattenOutlineTree", () => {
  it("lists the expanded branches in depth order", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const expanded = new Set(["cat:tables", "table:t_users"]);
    const rows = flattenOutlineTree(tree, expanded);
    assert.deepEqual(
      rows.map((row) => row.node.id),
      [
        "cat:tables",
        "table:t_users",
        "field:t_users:f_id",
        "field:t_users:f_name",
        "table:t_orders",
        "cat:relationships",
        "cat:areas",
        "cat:notes",
        "cat:views",
        "cat:enums",
        "cat:types",
      ],
    );
    assert.equal(rows[0].depth, 0);
    assert.equal(rows[2].depth, 2);
    assert.equal(rows[1].hasChildren, true);
    assert.equal(rows[2].hasChildren, false);
  });
});

describe("outlineNodePath", () => {
  it("returns the ancestor chain of a node for a reveal", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const path = outlineNodePath(tree, "field:t_users:f_name");
    assert.deepEqual(
      path?.map((node) => node.id),
      ["cat:tables", "table:t_users", "field:t_users:f_name"],
    );
    assert.equal(outlineNodePath(tree, "field:nope:nada"), undefined);
  });
});

describe("outlineBranchIds", () => {
  it("collects every branch id, optionally skipping the tables", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const all = outlineBranchIds(tree);
    assert.ok(all.has("cat:tables"));
    assert.ok(all.has("table:t_users"));
    const noTables = outlineBranchIds(tree, (node) => node.kind !== "table");
    assert.ok(noTables.has("cat:tables"));
    assert.ok(!noTables.has("table:t_users"));
    // A leaf never lands in the set.
    assert.ok(!all.has("field:t_users:f_id"));
  });
});

describe("windowOutlineRows", () => {
  it("slices the visible window with an overscan and keeps the row index", () => {
    const tree = buildOutlineTree(sampleDiagram(), "physical");
    const rows = flattenOutlineTree(tree, outlineBranchIds(tree));
    const windowed = windowOutlineRows(rows, 0, 3 * 26);
    assert.equal(windowed.length > 3, true);
    assert.equal(windowed[0].index, 0);
    assert.equal(windowed[0].row.node.id, rows[0].node.id);
    const tail = windowOutlineRows(rows, rows.length * 26, 600);
    assert.equal(tail.at(-1)?.row.node.id, rows.at(-1)?.node.id);
    assert.equal(tail.at(-1)?.index, rows.length - 1);
  });
});
