import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DATABASE_TYPE_NAMES } from "./registry.ts";
import type { DatabaseType } from "../models/diagram.ts";
import { BUILTIN_FAMILIES, BUILTIN_FAMILY_IDS } from "./builtin-families.ts";

const DIALECTS: DatabaseType[] = [
  "generic",
  "mysql",
  "postgres",
  "sqlite",
  "mssql",
  "oraclesql",
  "mariadb",
];

const EXPECTED_IDS = [
  "string",
  "text",
  "integer",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "binary",
  "enum",
  "json",
  "uuid",
];

describe("builtin logical type families", () => {
  it("declares exactly the eleven builtin families, each flagged builtin", () => {
    assert.equal(BUILTIN_FAMILIES.length, 11);
    assert.deepEqual(
      BUILTIN_FAMILIES.map((f) => f.id),
      EXPECTED_IDS,
    );
    for (const family of BUILTIN_FAMILIES) {
      assert.equal(family.builtin, true);
    }
    assert.deepEqual([...BUILTIN_FAMILY_IDS], EXPECTED_IDS);
  });

  it("covers every dialect for every family (D1, spec section 3.2)", () => {
    for (const family of BUILTIN_FAMILIES) {
      for (const db of DIALECTS) {
        assert.ok(
          family.mappings[db],
          `${family.id} is missing a mapping for ${db}`,
        );
      }
    }
  });

  it("carries exactly 77 mapping entries (11 families x 7 dialects)", () => {
    const total = BUILTIN_FAMILIES.reduce(
      (count, family) => count + Object.keys(family.mappings).length,
      0,
    );
    assert.equal(total, 77);
  });

  it("only maps to physical type names known to the target dialect whitelist", () => {
    for (const family of BUILTIN_FAMILIES) {
      for (const db of DIALECTS) {
        const mapping = family.mappings[db];
        assert.ok(
          DATABASE_TYPE_NAMES[db].includes(mapping.type),
          `${family.id} -> ${db}.${mapping.type} is not in the ${db} whitelist`,
        );
      }
    }
  });

  it("only uses logical parameter keys length/precision/scale", () => {
    for (const family of BUILTIN_FAMILIES) {
      for (const param of family.params) {
        assert.ok(
          ["length", "precision", "scale"].includes(param.key),
          `${family.id} declares an unknown param key ${param.key}`,
        );
      }
      for (const db of DIALECTS) {
        for (const key of Object.keys(family.mappings[db].params ?? {})) {
          assert.ok(
            ["length", "precision", "scale"].includes(key),
            `${family.id} -> ${db} carries an unknown param key ${key}`,
          );
        }
      }
    }
  });

  it("defaults string length to 255 (spec section 3.2)", () => {
    const stringFamily = BUILTIN_FAMILIES.find((f) => f.id === "string");
    assert.ok(stringFamily);
    assert.deepEqual(stringFamily.defaultParams, { length: 255 });
  });
});
