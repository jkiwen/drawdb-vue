import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import { MemoryStorageAdapter } from "./memory-adapter.ts";

const makeDiagram = (id: string, title = "diagram") => {
  const diagram = createEmptyDiagram({ database: "mysql", title, id });
  diagram.tables = [];
  return diagram;
};

test("memory storage adapter: saves and loads a diagram", async () => {
  const adapter = new MemoryStorageAdapter();
  const diagram = makeDiagram("d1");

  await adapter.save(diagram);
  const loaded = await adapter.load("d1");

  assert.equal(loaded?.id, "d1");
  assert.equal(loaded?.title, "diagram");
  assert.equal(loaded?.database, "mysql");
});

test("memory storage adapter: returns undefined for unknown ids", async () => {
  const adapter = new MemoryStorageAdapter();
  assert.equal(await adapter.load("missing"), undefined);
});

test("memory storage adapter: rejects a diagram without an id", async () => {
  const adapter = new MemoryStorageAdapter();
  const diagram = createEmptyDiagram({ database: "mysql" });

  await assert.rejects(() => adapter.save(diagram), /id/i);
});

test("memory storage adapter: overwrites an existing diagram on save", async () => {
  const adapter = new MemoryStorageAdapter();

  await adapter.save(makeDiagram("d1", "first"));
  await adapter.save(makeDiagram("d1", "second"));

  const loaded = await adapter.load("d1");
  assert.equal(loaded?.title, "second");
  assert.equal((await adapter.list()).length, 1);
});

test("memory storage adapter: deletes a diagram", async () => {
  const adapter = new MemoryStorageAdapter();
  await adapter.save(makeDiagram("d1"));

  await adapter.delete("d1");

  assert.equal(await adapter.load("d1"), undefined);
  assert.deepEqual(await adapter.list(), []);
});

test("memory storage adapter: deleting an unknown diagram is a no-op", async () => {
  const adapter = new MemoryStorageAdapter();
  await adapter.delete("missing");
  assert.deepEqual(await adapter.list(), []);
});

test("memory storage adapter: lists stored diagrams", async () => {
  const adapter = new MemoryStorageAdapter();
  await adapter.save(makeDiagram("d1"));
  await adapter.save(makeDiagram("d2"));

  const list = await adapter.list();
  assert.equal(list.length, 2);
  assert.deepEqual((await adapter.listIds()).sort(), ["d1", "d2"]);
});

test("memory storage adapter: clear removes every diagram", async () => {
  const adapter = new MemoryStorageAdapter();
  await adapter.save(makeDiagram("d1"));
  await adapter.save(makeDiagram("d2"));

  await adapter.clear();

  assert.deepEqual(await adapter.list(), []);
});

test("memory storage adapter: returns a defensive copy of stored diagrams", async () => {
  const adapter = new MemoryStorageAdapter();
  const diagram = makeDiagram("d1");
  await adapter.save(diagram);

  diagram.title = "mutated outside";

  const loaded = await adapter.load("d1");
  assert.equal(loaded?.title, "diagram");
});
