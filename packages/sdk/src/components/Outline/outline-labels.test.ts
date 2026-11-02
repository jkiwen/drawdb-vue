import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Diagram, LogicalRelationship, Relationship } from "@drawdb/core";
import { relationshipLabels } from "./outline-labels.ts";

/**
 * The two names of a relationship.
 *
 * The tree names an object after the layer it shows (design 3.1): the logical
 * view leads with the logical name and the physical view with the physical
 * one, and the name of the other layer is the secondary label. A rename in
 * the outline has to be visible in the layer it was made in, so the label of
 * a layer is the name that layer writes.
 */
const diagram = {
  tables: [
    { id: "t1", name: "orders", x: 0, y: 0, logical: { id: "le1", name: "Order", attributes: [] }, fields: [] },
    { id: "t2", name: "users", x: 0, y: 0, logical: { id: "le2", name: "User", attributes: [] }, fields: [] },
  ],
} as unknown as Diagram;

const relationship: Relationship = {
  id: "r1",
  startTableId: "t1",
  startFieldId: "f1",
  endTableId: "t2",
  endFieldId: "f2",
  name: "fk_orders_users",
};

const logical: LogicalRelationship = { id: "r1", name: "places" };

describe("the labels of a relationship", () => {
  it("leads with the physical name in the physical view", () => {
    const labels = relationshipLabels(relationship, logical, diagram, "physical");
    assert.equal(labels.label, "fk_orders_users");
    assert.equal(labels.altLabel, "places");
  });

  it("leads with the logical name in the logical view", () => {
    const labels = relationshipLabels(relationship, logical, diagram, "logical");
    assert.equal(labels.label, "places");
    assert.equal(labels.altLabel, "fk_orders_users");
  });

  it("names the relationship after the other layer when its own layer has no name", () => {
    const unnamed = { ...relationship, name: "" };
    assert.equal(relationshipLabels(unnamed, logical, diagram, "logical").label, "places");
    assert.equal(relationshipLabels(unnamed, logical, diagram, "physical").label, "places");
  });

  it("falls back to the names of the two tables when no layer names it", () => {
    const unnamed = { ...relationship, name: "" };
    const labels = relationshipLabels(unnamed, undefined, diagram, "logical");
    assert.equal(labels.label, "Order → User");
    assert.equal(labels.altLabel, undefined);
    assert.equal(
      relationshipLabels(unnamed, undefined, diagram, "physical").label,
      "orders → users",
    );
  });
});
