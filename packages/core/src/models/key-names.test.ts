import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keyPrefix, nextKeyName } from "./key-names.ts";

describe("keyPrefix", () => {
  it("names the four kinds the way the design does", () => {
    assert.equal(keyPrefix("primary"), "PK_");
    assert.equal(keyPrefix("unique"), "UK_");
    assert.equal(keyPrefix("foreign"), "FK_");
    assert.equal(keyPrefix("index"), "Idx_");
  });
});

describe("nextKeyName", () => {
  it("puts the prefix in front of the table name", () => {
    assert.equal(nextKeyName("primary", "users"), "PK_users");
    assert.equal(nextKeyName("unique", "users"), "UK_users");
    assert.equal(nextKeyName("index", "users"), "Idx_users");
  });

  it("joins both tables for a foreign key", () => {
    assert.equal(nextKeyName("foreign", "posts", "users"), "FK_posts_users");
  });

  it("numbers a name that is already taken", () => {
    assert.equal(nextKeyName("primary", "users", undefined, ["PK_users"]), "PK_users_2");
    assert.equal(
      nextKeyName("primary", "users", undefined, ["PK_users", "PK_users_2"]),
      "PK_users_3",
    );
  });

  it("counts a taken name whatever its case", () => {
    assert.equal(nextKeyName("index", "Users", undefined, ["idx_users"]), "Idx_Users_2");
  });

  it("keeps the table name as it is written", () => {
    assert.equal(nextKeyName("unique", "user profiles"), "UK_user profiles");
  });

  it("numbers past the gap a removed name leaves", () => {
    assert.equal(
      nextKeyName("foreign", "posts", "users", ["FK_posts_users"]),
      "FK_posts_users_2",
    );
  });
});
