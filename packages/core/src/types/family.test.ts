import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { LogicalTypeRef } from "../models/logical.ts";
import type {
  LogicalFamilyId,
  LogicalTypeFamily,
  ParamSpec,
  TypeMapping,
  TypeParams,
} from "./family.ts";
import type { DatabaseType } from "../models/diagram.ts";

// The mutual exclusion of the two LogicalTypeRef shapes is a compile-time
// contract: these @ts-expect-error lines fail `pnpm typecheck` if the union
// ever admits both keys at once.
const familyRef: LogicalTypeRef = { family: "string" };
const domainRef: LogicalTypeRef = { domainId: "unicode-string" };

// @ts-expect-error family and domainId are mutually exclusive
const invalidRef: LogicalTypeRef = { family: "string", domainId: "x" };

// @ts-expect-error a bare string is not a LogicalTypeRef
const stringRef: LogicalTypeRef = "string";

describe("type family model shapes", () => {
  it("represents a family reference and a domain reference", () => {
    assert.deepEqual(familyRef, { family: "string" });
    assert.deepEqual(domainRef, { domainId: "unicode-string" });
    assert.equal(typeof invalidRef, "object");
    assert.equal(typeof stringRef, "string");
  });

  it("describes a logical type family with a mapping per dialect", () => {
    const params: ParamSpec[] = [
      { key: "length", label: "type.params.length", default: 50, min: 1 },
    ];
    const mapping: TypeMapping = { type: "VARCHAR", params: { length: 50 } };
    const mappings = Object.fromEntries(
      (
        [
          "mysql",
          "postgres",
          "sqlite",
          "mariadb",
          "mssql",
          "oraclesql",
          "generic",
        ] satisfies DatabaseType[]
      ).map((database) => [database, mapping]),
    ) as Record<DatabaseType, TypeMapping>;
    const family: LogicalTypeFamily = {
      id: "string" satisfies LogicalFamilyId,
      label: "type.family.string",
      params,
      defaultParams: { length: 50 } satisfies TypeParams,
      mappings,
      builtin: true,
    };
    assert.equal(family.mappings.postgres.type, "VARCHAR");
    assert.equal(family.builtin, true);
  });
});
