import assert from "node:assert/strict";
import test from "node:test";

import { createPinia, setActivePinia } from "pinia";

import { BUILTIN_FAMILIES, resolveType } from "@drawdb/core";

import { TYPE_SCOPE_STORAGE_KEY, useTypeScopeStore } from "./type-scope.ts";

function fresh(): void {
  setActivePinia(createPinia());
}

function clearStorage(): void {
  localStorage.removeItem(TYPE_SCOPE_STORAGE_KEY);
}

test("starts from the builtin families and no domains", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  assert.deepEqual(scope.families.length, BUILTIN_FAMILIES.length);
  assert.deepEqual(scope.domains, []);
  assert.deepEqual(scope.getSnapshot().application.domains ?? {}, {});
  assert.deepEqual(scope.getSnapshot().diagram, {}, "P6 never writes the diagram layer");
});

test("keeps a registered domain across reloads of the application", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  const result = scope.registerDomain({ id: "d_code", name: "code", family: "string" });

  assert.deepEqual(result, { ok: true });
  assert.equal(scope.getSnapshot().application.domains?.code?.name, "code");
  assert.deepEqual(
    scope.domains.map((domain) => domain.name),
    ["code"],
  );

  // A second store on the same storage sees the domain: that is what a reload does.
  fresh();
  const again = useTypeScopeStore();

  assert.equal(again.getSnapshot().application.domains?.code?.family, "string");
  clearStorage();
});

test("refuses a domain whose name is already taken", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  assert.deepEqual(scope.registerDomain({ id: "d_one", name: "code", family: "string" }), {
    ok: true,
  });
  const second = scope.registerDomain({ id: "d_two", name: "Code", family: "string" });

  assert.equal(second.ok, false);
  if (second.ok) {
    return;
  }
  assert.equal(second.diagnostic.code, "NAME_CONFLICT");
  // The refusal leaves the scope alone.
  assert.equal(scope.getSnapshot().application.domains?.Code, undefined);
  assert.equal(scope.domains.length, 1);
  clearStorage();
});

test("lets a mapping override change what a field suggests", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  scope.updateMapping("string", "mysql", { type: "TINYTEXT" });

  const attribute = { id: "a1", name: "code", logicalType: { family: "string" as const } };
  const mysql = resolveType(attribute, "mysql", scope.getSnapshot());
  const postgres = resolveType(attribute, "postgres", scope.getSnapshot());

  assert.equal(mysql.suggested?.type, "TINYTEXT");
  assert.equal(postgres.suggested?.type, "VARCHAR", "another dialect keeps the builtin mapping");
  clearStorage();
});

test("resetToBuiltins drops both of the editable layers", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  scope.registerDomain({ id: "d_code", name: "code", family: "string" });
  scope.updateMapping("integer", "mysql", { type: "BIGINT" });
  scope.resetToBuiltins();

  const snapshot = scope.getSnapshot();
  assert.deepEqual(snapshot.application, {});
  assert.deepEqual(snapshot.workspace, {});
  clearStorage();
});

test("renames and removes a domain of the application", () => {
  fresh();
  clearStorage();
  const scope = useTypeScopeStore();

  scope.registerDomain({ id: "d_code", name: "code", family: "string" });
  assert.deepEqual(scope.renameDomain("code", "short_code"), { ok: true });
  assert.equal(scope.getSnapshot().application.domains?.short_code?.name, "short_code");
  assert.equal(scope.getSnapshot().application.domains?.code, undefined);

  scope.removeDomain("short_code");
  assert.equal(scope.getSnapshot().application.domains?.short_code, undefined);
  assert.deepEqual(scope.domains, []);
  clearStorage();
});
