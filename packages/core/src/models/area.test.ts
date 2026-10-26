import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AREA_DESCRIPTION_MAX_LENGTH,
  AREA_NAME_MAX_LENGTH,
  validateAreaProps,
} from "./area.ts";

describe("validateAreaProps", () => {
  it("accepts a valid name and description", () => {
    assert.deepEqual(
      validateAreaProps({ name: "Auth", description: "Auth tables" }),
      [],
    );
  });

  it("accepts an omitted description", () => {
    assert.deepEqual(validateAreaProps({ name: "Auth" }), []);
  });

  it("rejects an empty name", () => {
    assert.deepEqual(validateAreaProps({ name: "" }), ["name_required"]);
  });

  it("rejects a whitespace only name", () => {
    assert.deepEqual(validateAreaProps({ name: "   " }), ["name_required"]);
  });

  it("rejects a name longer than the limit", () => {
    const name = "a".repeat(AREA_NAME_MAX_LENGTH + 1);
    assert.deepEqual(validateAreaProps({ name }), ["name_too_long"]);
  });

  it("accepts a name at the limit", () => {
    const name = "a".repeat(AREA_NAME_MAX_LENGTH);
    assert.deepEqual(validateAreaProps({ name }), []);
  });

  it("rejects a description longer than the limit", () => {
    const description = "a".repeat(AREA_DESCRIPTION_MAX_LENGTH + 1);
    assert.deepEqual(validateAreaProps({ name: "Auth", description }), [
      "description_too_long",
    ]);
  });

  it("accepts a description at the limit", () => {
    const description = "a".repeat(AREA_DESCRIPTION_MAX_LENGTH);
    assert.deepEqual(validateAreaProps({ name: "Auth", description }), []);
  });

  it("ignores the fields that are not provided", () => {
    assert.deepEqual(validateAreaProps({}), []);
    assert.deepEqual(validateAreaProps({ description: "only a description" }), []);
  });

  it("reports every broken rule at once", () => {
    const description = "a".repeat(AREA_DESCRIPTION_MAX_LENGTH + 1);
    assert.deepEqual(validateAreaProps({ name: "", description }), [
      "name_required",
      "description_too_long",
    ]);
  });
});
