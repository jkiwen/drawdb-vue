import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import { createEmptyDiagram } from "../models/diagram.ts";
import { IndexedDBStorageAdapter } from "./indexeddb-adapter.ts";

const makeDiagram = (id: string, title = "diagram") =>
  createEmptyDiagram({ database: "postgres", title, id });

let counter = 0;
const uniqueDbName = () => `drawdb-test-${process.pid}-${counter++}`;

test("indexeddb storage adapter: saves and loads a diagram", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  const diagram = makeDiagram("d1");

  await adapter.save(diagram);
  const loaded = await adapter.load("d1");

  assert.equal(loaded?.id, "d1");
  assert.equal(loaded?.title, "diagram");
  assert.equal(loaded?.database, "postgres");
  await adapter.close();
});

test("indexeddb storage adapter: returns undefined for unknown ids", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  assert.equal(await adapter.load("missing"), undefined);
  await adapter.close();
});

test("indexeddb storage adapter: rejects a diagram without an id", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  await assert.rejects(
    () => adapter.save(createEmptyDiagram({ database: "postgres" })),
    /id/i,
  );
  await adapter.close();
});

test("indexeddb storage adapter: overwrites an existing diagram on save", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });

  await adapter.save(makeDiagram("d1", "first"));
  await adapter.save(makeDiagram("d1", "second"));

  const loaded = await adapter.load("d1");
  assert.equal(loaded?.title, "second");
  assert.equal((await adapter.list()).length, 1);
  await adapter.close();
});

test("indexeddb storage adapter: deletes a diagram", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  await adapter.save(makeDiagram("d1"));

  await adapter.delete("d1");

  assert.equal(await adapter.load("d1"), undefined);
  await adapter.close();
});

test("indexeddb storage adapter: lists stored diagrams", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  await adapter.save(makeDiagram("d1"));
  await adapter.save(makeDiagram("d2"));

  const list = await adapter.list();
  assert.equal(list.length, 2);
  assert.deepEqual((await adapter.listIds()).sort(), ["d1", "d2"]);
  await adapter.close();
});

test("indexeddb storage adapter: clear removes every diagram", async () => {
  const adapter = new IndexedDBStorageAdapter({ dbName: uniqueDbName() });
  await adapter.save(makeDiagram("d1"));

  await adapter.clear();

  assert.deepEqual(await adapter.list(), []);
  await adapter.close();
});

test("indexeddb storage adapter: persists across adapter instances", async () => {
  const dbName = uniqueDbName();
  const first = new IndexedDBStorageAdapter({ dbName });
  await first.save(makeDiagram("d1"));
  await first.close();

  const second = new IndexedDBStorageAdapter({ dbName });
  const loaded = await second.load("d1");
  assert.equal(loaded?.id, "d1");
  await second.close();
});
