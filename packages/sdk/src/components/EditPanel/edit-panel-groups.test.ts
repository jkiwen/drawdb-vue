import assert from "node:assert/strict";
import test from "node:test";
import type { Diagram, Relationship, Table } from "@drawdb/core";
import { createEmptyDiagram } from "@drawdb/core";
import {
  appearanceValues,
  sourceKey,
  tableConstraints,
  tableIndexes,
} from "./edit-panel-groups.ts";
import { resolvePanelTarget } from "./edit-panel-model.ts";

function table(overrides: Partial<Table> = {}): Table {
  return {
    id: "t_orders",
    name: "orders",
    logical: { id: "l_orders", name: "order", attributes: [] },
    x: 0,
    y: 0,
    fields: [
      {
        id: "f_id",
        name: "id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "mapped",
        primary: true,
      },
      {
        id: "f_code",
        name: "code",
        fieldType: { type: "VARCHAR", length: 20 },
        fieldTypeSource: "explicit",
      },
      {
        id: "f_user",
        name: "user_id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "imported",
      },
    ],
    uniqueConstraints: [{ name: "uq_code", fields: ["f_code"] }],
    indices: [{ name: "idx_user", unique: false, fields: ["f_user"] }],
    ...overrides,
  };
}

function relationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: "r_1",
    startTableId: "t_orders",
    startFieldId: "f_user",
    endTableId: "t_users",
    endFieldId: "f_id",
    name: "fk_orders_user",
    ...overrides,
  };
}

test("collects the primary key, the unique constraints and the foreign keys", () => {
  const rows = tableConstraints(table(), [relationship()]);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.name, row.fields]),
    [
      ["primary", "PRIMARY", ["id"]],
      ["unique", "uq_code", ["code"]],
      ["foreign", "fk_orders_user", ["user_id"]],
    ],
  );
});

test("keeps the foreign keys on the child side only", () => {
  const parent = table({ id: "t_users", name: "users", indices: [] });
  const kinds = tableConstraints(parent, [relationship()]).map((row) => row.kind);
  assert.deepEqual(kinds.includes("foreign"), false);
});

test("names the fields of an index, falling back to the raw id", () => {
  const rows = tableIndexes(
    table({
      indices: [
        { name: "idx_user", unique: false, fields: ["f_user", "f_gone"] },
      ],
    }),
  );
  assert.deepEqual(rows, [
    { id: "idx_user", name: "idx_user", unique: false, fields: ["user_id", "f_gone"] },
  ]);
});

test("reports a single index value across the selection", () => {
  const a = table({ indices: [{ name: "a", unique: true, fields: [] }] });
  const b = table({ id: "t_other", indices: [{ name: "b", unique: true, fields: [] }] });
  const indexes = tableIndexes(b);
  assert.equal(indexes.length, 1);
  assert.equal(appearanceValues([a, b]).colorMultiple, false);
});

test("marks an appearance property that the selection disagrees on", () => {
  const a = table({ color: "#112233", locked: true });
  const b = table({ id: "t_other", color: "#445566", locked: true });
  const values = appearanceValues([a, b]);
  assert.equal(values.color, "");
  assert.equal(values.colorMultiple, true);
  assert.equal(values.locked, true);
  assert.equal(values.lockedMultiple, false);
  assert.equal(values.detailsMultiple, false);
});

test("maps the type source to its label key", () => {
  assert.equal(sourceKey("mapped"), "edit_panel_source_mapped");
  assert.equal(sourceKey("explicit"), "edit_panel_source_explicit");
  assert.equal(sourceKey("imported"), "edit_panel_source_imported");
});

test("falls back to the diagram when nothing is selected", () => {
  const diagram: Diagram = createEmptyDiagram();
  const target = resolvePanelTarget(
    { tableIds: [], relationshipIds: [], areaIds: [], noteIds: [], fields: [] },
    diagram,
  );
  assert.equal(target.kind, "diagram");
});
