import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTable } from "@drawdb/core";
import type { Relationship, Table } from "@drawdb/core";
import {
  canSavePairs,
  defaultForeignKeyName,
  freeFields,
  isPairComplete,
  nextIndexName,
  nextUniqueName,
  pairsOf,
  syncPairs,
} from "./constraint-forms.ts";

/**
 * The pure helpers behind the create forms of the constraints and indexes
 * groups: the default names, the fields a key can still take, and the
 * translation between the column pairs an editor shows and the four ids a
 * relationship stores.
 */
function users(): Table {
  const table = createTable({ id: "t_users", name: "users", x: 0, y: 0 });
  table.fields = [
    { id: "f_id", name: "id", fieldType: { type: "INT" }, fieldTypeSource: "mapped" },
    { id: "f_email", name: "email", fieldType: { type: "VARCHAR" }, fieldTypeSource: "mapped" },
  ];
  return table;
}

describe("the names a new key gets", () => {
  it("numbers a unique key until the name is free", () => {
    const table = users();
    assert.equal(nextUniqueName(table), "uk_users_1");
    table.uniqueConstraints = [{ id: "k1", name: "uk_users_1", fields: [] }];
    assert.equal(nextUniqueName(table), "uk_users_2");
  });

  it("numbers an index until the name is free", () => {
    const table = users();
    assert.equal(nextIndexName(table), "idx_users_1");
    table.indices = [{ id: "i1", name: "idx_users_1", unique: false, fields: [] }];
    assert.equal(nextIndexName(table), "idx_users_2");
  });

  it("names a foreign key after the two tables it joins", () => {
    const child = users();
    const parent = createTable({ id: "t_orders", name: "orders", x: 0, y: 0 });
    assert.equal(defaultForeignKeyName(child, parent), "fk_users_orders");
  });
});

describe("the fields a key can still take", () => {
  it("drops the ones already used", () => {
    const table = users();
    assert.deepEqual(
      freeFields(table.fields, ["f_id"]).map((field) => field.id),
      ["f_email"],
    );
  });

  it("compares ids across string and number", () => {
    const table = users();
    const field = table.fields[0]!;
    field.id = 1 as unknown as string;
    assert.deepEqual(
      freeFields(table.fields, ["1"]).map((id) => String(id.id)),
      ["f_email"],
    );
  });
});

describe("the pairs of a foreign key", () => {
  const relationship: Relationship = {
    id: "r1",
    startTableId: "t_users",
    startFieldId: "f_id",
    endTableId: "t_orders",
    endFieldId: "o_id",
    name: "fk_orders_user",
    fields: [
      { startFieldId: "f_id", endFieldId: "o_id" },
      { startFieldId: "f_email", endFieldId: "o_email" },
    ],
  };

  it("reads the stored pairs", () => {
    assert.deepEqual(pairsOf(relationship), [
      { startFieldId: "f_id", endFieldId: "o_id" },
      { startFieldId: "f_email", endFieldId: "o_email" },
    ]);
  });

  it("mirrors the first pair into the four ids of the relationship", () => {
    assert.deepEqual(
      syncPairs([
        { startFieldId: "f_email", endFieldId: "o_email" },
        { startFieldId: "f_id", endFieldId: "o_id" },
      ]),
      {
        startFieldId: "f_email",
        endFieldId: "o_email",
        fields: [
          { startFieldId: "f_email", endFieldId: "o_email" },
          { startFieldId: "f_id", endFieldId: "o_id" },
        ],
      },
    );
  });

  it("falls back to the four ids when a relationship stores no pairs", () => {
    const single: Relationship = { ...relationship, fields: undefined };
    assert.deepEqual(pairsOf(single), [
      { startFieldId: "f_id", endFieldId: "o_id" },
    ]);
  });

  it("needs both sides of every pair and no repeated local column", () => {
    assert.equal(isPairComplete({ startFieldId: "f_id", endFieldId: "o_id" }), true);
    assert.equal(isPairComplete({ startFieldId: "", endFieldId: "o_id" }), false);
    assert.equal(
      canSavePairs([
        { startFieldId: "f_id", endFieldId: "o_id" },
        { startFieldId: "f_email", endFieldId: "o_email" },
      ]),
      true,
    );
    assert.equal(canSavePairs([]), false);
    assert.equal(
      canSavePairs([
        { startFieldId: "f_id", endFieldId: "o_id" },
        { startFieldId: "f_id", endFieldId: "o_email" },
      ]),
      false,
    );
    assert.equal(canSavePairs([{ startFieldId: "f_id", endFieldId: "" }]), false);
  });
});
