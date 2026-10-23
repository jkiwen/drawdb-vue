import test from "node:test";
import assert from "node:assert/strict";

import {
  MetadataRegistry,
  MetadataSchemaRegistryError,
} from "./metadata-registry.ts";
import type { MetadataSchema } from "./metadata-schema.ts";

const schema: MetadataSchema = {
  id: "table.owner",
  name: "Owner",
  target: "table",
  properties: [
    { key: "owner", label: "Owner", type: "string", required: true },
    { key: "tier", label: "Tier", type: "number", default: 1 },
  ],
};

test("metadata registry: registers and retrieves a schema", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  assert.equal(registry.get("table.owner")?.id, "table.owner");
  assert.equal(registry.list().length, 1);
});

test("metadata registry: rejects a duplicate schema id", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  assert.throws(() => registry.register(schema), MetadataSchemaRegistryError);
});

test("metadata registry: lists schemas filtered by target", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);
  registry.register({ ...schema, id: "field.owner", target: "field" });

  assert.equal(registry.list().length, 2);
  assert.equal(registry.list("table").length, 1);
  assert.equal(registry.list("field")[0].id, "field.owner");
});

test("metadata registry: unregisters a schema", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  assert.equal(registry.unregister("table.owner"), true);
  assert.equal(registry.unregister("table.owner"), false);
  assert.equal(registry.list().length, 0);
});

test("metadata registry: reports a missing required property", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  const issues = registry.validate("table.owner", {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].key, "owner");
  assert.match(issues[0].message, /required/i);
});

test("metadata registry: reports a property of the wrong type", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  const issues = registry.validate("table.owner", { owner: 42 });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].key, "owner");
  assert.match(issues[0].message, /string/i);
});

test("metadata registry: reports an unknown property", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  const issues = registry.validate("table.owner", { owner: "ann", nope: 1 });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].key, "nope");
  assert.match(issues[0].message, /unknown/i);
});

test("metadata registry: accepts a valid value set", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  assert.deepEqual(registry.validate("table.owner", { owner: "ann", tier: 2 }), []);
});

test("metadata registry: applies schema defaults", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  const values = registry.applyDefaults("table.owner", { owner: "ann" });

  assert.equal(values.owner, "ann");
  assert.equal(values.tier, 1);
});

test("metadata registry: does not overwrite provided values with defaults", () => {
  const registry = new MetadataRegistry();
  registry.register(schema);

  const values = registry.applyDefaults("table.owner", { owner: "ann", tier: 7 });

  assert.equal(values.tier, 7);
});

test("metadata registry: validating an unknown schema reports an issue", () => {
  const registry = new MetadataRegistry();

  const issues = registry.validate("missing", {});

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /no metadata schema/i);
});
