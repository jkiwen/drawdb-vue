import test from "node:test";
import assert from "node:assert/strict";

import type { Field } from "../models/field.ts";
import type { Relationship } from "../models/relationship.ts";
import type { Table } from "../models/table.ts";
import { autoArrange } from "./auto-arrange.ts";
import { inferRelationships } from "./auto-relationships.ts";

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 50;
const FIELD_HEIGHT = 36;

function field(overrides: Partial<Field> & { id: string }): Field {
  return {
    name: "field",
    fieldType: { type: "INTEGER" },
    fieldTypeSource: "explicit",
    ...overrides,
  };
}

function table(overrides: Partial<Table> & { id: string }): Table {
  const base: Table = {
    name: "table",
    x: 0,
    y: 0,
    fields: [],
    logical: { id: "le-table", name: "table", attributes: [] },
    id: overrides.id,
  };
  const merged = { ...base, ...overrides };
  if (!overrides.logical) {
    merged.logical = { id: `le-${overrides.id}`, name: merged.name, attributes: [] };
  }
  return merged;
}

function relationship(
  overrides: Partial<Relationship> & { id: string },
): Relationship {
  return {
    startTableId: "t1",
    startFieldId: "f1",
    endTableId: "t2",
    endFieldId: "f2",
    ...overrides,
  };
}

/** The height of a table as the layout computes it. */
function heightOf(table: Table): number {
  return HEADER_HEIGHT + FIELD_HEIGHT * (table.fields?.length ?? 0);
}

/** True when the two boxes overlap. */
function overlaps(
  a: { x: number; y: number },
  aTable: Table,
  b: { x: number; y: number },
  bTable: Table,
): boolean {
  return !(
    a.x + TABLE_WIDTH <= b.x ||
    b.x + TABLE_WIDTH <= a.x ||
    a.y + heightOf(aTable) <= b.y ||
    b.y + heightOf(bTable) <= a.y
  );
}

test("layout: returns one coordinate per table, in the input order", () => {
  const tables = [
    table({ id: "t1", name: "a", x: 10, y: 20 }),
    table({ id: "t2", name: "b", x: 30, y: 40 }),
    table({ id: "t3", name: "c", x: 50, y: 60 }),
  ];

  const positions = autoArrange(tables, []);

  assert.equal(positions.length, 3);
});

test("layout: moves the unlocked tables and leaves the locked ones", () => {
  const tables = [
    table({ id: "t1", name: "a", x: 500, y: 500 }),
    table({ id: "t2", name: "b", x: 700, y: 900, locked: true }),
  ];

  const positions = autoArrange(tables, []);

  assert.deepEqual(positions[1], { x: 700, y: 900 });
  assert.notDeepEqual(positions[0], { x: 500, y: 500 });
});

test("layout: does not overlap two tables", () => {
  const tables = [
    table({ id: "t1", name: "users", fields: [field({ id: "f1" })] }),
    table({ id: "t2", name: "posts", fields: [field({ id: "f2" })] }),
  ];
  const relationships = [
    relationship({ id: "r1", startTableId: "t1", endTableId: "t2" }),
  ];

  const positions = autoArrange(tables, relationships);

  assert.equal(
    overlaps(positions[0], tables[0], positions[1], tables[1]),
    false,
  );
});

test("layout: places an isolated table apart from the others", () => {
  const tables = [
    table({ id: "t1", name: "users", fields: [field({ id: "f1" })] }),
    table({ id: "t2", name: "posts", fields: [field({ id: "f2" })] }),
    table({ id: "t3", name: "logs", fields: [field({ id: "f3" })] }),
  ];
  const relationships = [
    relationship({ id: "r1", startTableId: "t1", endTableId: "t2" }),
  ];

  const positions = autoArrange(tables, relationships, { isolatedGap: 60 });

  const connected = positions.slice(0, 2);
  const isolated = positions[2];
  const bottom = Math.max(
    connected[0].y + heightOf(tables[0]),
    connected[1].y + heightOf(tables[1]),
  );

  assert.ok(isolated.y - bottom >= 60);
});

test("layout: honours the direction option", () => {
  const tables = [
    table({ id: "t1", name: "users", fields: [field({ id: "f1" })] }),
    table({ id: "t2", name: "posts", fields: [field({ id: "f2" })] }),
  ];
  const relationships = [
    relationship({ id: "r1", startTableId: "t1", endTableId: "t2" }),
  ];

  const topToBottom = autoArrange(tables, relationships, { direction: "TB" });
  const leftToRight = autoArrange(tables, relationships, { direction: "LR" });

  assert.notDeepEqual(topToBottom, leftToRight);
});

test("layout: keeps the coordinates of a single table", () => {
  const tables = [table({ id: "t1", name: "users", x: 120, y: 240 })];

  const positions = autoArrange(tables, []);

  assert.deepEqual(positions, [{ x: 120, y: 240 }]);
});

test("layout: returns the original coordinates for an empty list", () => {
  assert.deepEqual(autoArrange([], []), []);
});

test("layout: does not modify the input tables", () => {
  const tables = [
    table({ id: "t1", name: "users", x: 10, y: 20, fields: [field({ id: "f1" })] }),
    table({ id: "t2", name: "posts", x: 30, y: 40, fields: [field({ id: "f2" })] }),
  ];
  const relationships = [
    relationship({ id: "r1", startTableId: "t1", endTableId: "t2" }),
  ];
  const before = JSON.stringify({ tables, relationships });

  autoArrange(tables, relationships);

  assert.equal(JSON.stringify({ tables, relationships }), before);
});

test("layout: infers a relationship from a user_id field", () => {
  const users = table({
    id: "t1",
    name: "users",
    fields: [field({ id: "u1", name: "id", primary: true })],
  });
  const posts = table({
    id: "t2",
    name: "posts",
    fields: [field({ id: "p1", name: "user_id" })],
  });

  const candidates = inferRelationships([users, posts], []);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].startTableId, "t2");
  assert.equal(candidates[0].startFieldId, "p1");
  assert.equal(candidates[0].endTableId, "t1");
  assert.equal(candidates[0].endFieldId, "u1");
  assert.equal(candidates[0].cardinality, "many_to_one");
});

test("layout: infers a relationship from a users_id field", () => {
  const users = table({
    id: "t1",
    name: "users",
    fields: [field({ id: "u1", name: "id", primary: true })],
  });
  const posts = table({
    id: "t2",
    name: "posts",
    fields: [field({ id: "p1", name: "users_id" })],
  });

  const candidates = inferRelationships([users, posts], []);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].startFieldId, "p1");
  assert.equal(candidates[0].endFieldId, "u1");
});

test("layout: skips a field pair that already has a relationship", () => {
  const users = table({
    id: "t1",
    name: "users",
    fields: [field({ id: "u1", name: "id", primary: true })],
  });
  const posts = table({
    id: "t2",
    name: "posts",
    fields: [field({ id: "p1", name: "user_id" })],
  });
  const existing = [
    relationship({
      id: "r1",
      startTableId: "t2",
      startFieldId: "p1",
      endTableId: "t1",
      endFieldId: "u1",
    }),
  ];

  const candidates = inferRelationships([users, posts], existing);

  assert.equal(candidates.length, 0);
});

test("layout: skips a self reference", () => {
  const categories = table({
    id: "t1",
    name: "categories",
    fields: [
      field({ id: "c1", name: "id", primary: true }),
      field({ id: "c2", name: "parent_id" }),
    ],
  });

  const candidates = inferRelationships([categories], []);

  assert.equal(candidates.length, 0);
});

test("layout: marks the cardinality one_to_one when the child field is unique", () => {
  const users = table({
    id: "t1",
    name: "users",
    fields: [field({ id: "u1", name: "id", primary: true })],
  });
  const posts = table({
    id: "t2",
    name: "posts",
    fields: [field({ id: "p1", name: "user_id", unique: true })],
  });

  const candidates = inferRelationships([users, posts], []);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].cardinality, "one_to_one");
});

test("layout: does not modify the input tables or relationships", () => {
  const users = table({
    id: "t1",
    name: "users",
    fields: [field({ id: "u1", name: "id", primary: true })],
  });
  const posts = table({
    id: "t2",
    name: "posts",
    fields: [field({ id: "p1", name: "user_id" })],
  });
  const existing = [
    relationship({
      id: "r1",
      startTableId: "t2",
      startFieldId: "p1",
      endTableId: "t1",
      endFieldId: "u1",
    }),
  ];
  const before = JSON.stringify({ users, posts, existing });

  inferRelationships([users, posts], existing);

  assert.equal(JSON.stringify({ users, posts, existing }), before);
});
