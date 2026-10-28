import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyDiagram } from "../models/diagram.ts";
import {
  createDefaultViewState,
  displayModeForToggles,
  togglesForDisplayMode,
} from "../models/view-state.ts";
import { exportDiagramJson } from "./export.ts";
import { importDiagramJson } from "./import.ts";

describe("view state model", () => {
  it("a new diagram carries the default view state", () => {
    const diagram = createEmptyDiagram();
    assert.equal(diagram.viewState?.viewLayer, "physical");
    assert.equal(diagram.viewState?.displayMode, "attributes");
    assert.deepEqual(diagram.viewState?.toggles, {
      description: false,
      fields: true,
      pkUkFk: false,
      indexes: false,
    });
  });

  it("the display modes are presets of the four toggles", () => {
    assert.deepEqual(togglesForDisplayMode("entity"), {
      description: false,
      fields: false,
      pkUkFk: false,
      indexes: false,
    });
    assert.deepEqual(togglesForDisplayMode("definition"), {
      description: true,
      fields: false,
      pkUkFk: false,
      indexes: false,
    });
    assert.deepEqual(togglesForDisplayMode("attributes"), {
      description: false,
      fields: true,
      pkUkFk: false,
      indexes: false,
    });
    assert.deepEqual(togglesForDisplayMode("all"), {
      description: true,
      fields: true,
      pkUkFk: true,
      indexes: true,
    });
  });

  it("derives the mode from toggles, and reports custom for a manual mix", () => {
    assert.equal(displayModeForToggles(togglesForDisplayMode("entity")), "entity");
    assert.equal(displayModeForToggles(togglesForDisplayMode("all")), "all");
    assert.equal(
      displayModeForToggles({
        description: false,
        fields: true,
        pkUkFk: true,
        indexes: false,
      }),
      "custom",
    );
  });
});

describe("view state serialization", () => {
  it("round trips the view state of a diagram", () => {
    const diagram = createEmptyDiagram({ title: "t" });
    diagram.viewState = {
      viewLayer: "logical",
      displayMode: "custom",
      toggles: { description: true, fields: true, pkUkFk: true, indexes: false },
    };
    const restored = importDiagramJson(exportDiagramJson(diagram));
    assert.deepEqual(restored.viewState, diagram.viewState);
  });

  it("backfills the default view state for a legacy document", () => {
    const legacy = JSON.stringify({
      database: "postgres",
      tables: [],
      relationships: [],
      notes: [],
      subjectAreas: [],
      types: [],
      enums: [],
      views: [],
    });
    const restored = importDiagramJson(legacy);
    assert.deepEqual(restored.viewState, createDefaultViewState());
  });

  it("backfills defaults for a partial view state", () => {
    const partial = JSON.stringify({
      database: "postgres",
      tables: [],
      relationships: [],
      notes: [],
      subjectAreas: [],
      types: [],
      enums: [],
      views: [],
      viewState: { viewLayer: "logical" },
    });
    const restored = importDiagramJson(partial);
    assert.equal(restored.viewState?.viewLayer, "logical");
    assert.equal(restored.viewState?.displayMode, "attributes");
    assert.deepEqual(restored.viewState?.toggles, createDefaultViewState().toggles);
  });

  it("ignores an invalid view state and keeps the defaults", () => {
    const broken = JSON.stringify({
      database: "postgres",
      tables: [],
      relationships: [],
      notes: [],
      subjectAreas: [],
      types: [],
      enums: [],
      views: [],
      viewState: { viewLayer: "nonsense", displayMode: 42 },
    });
    const restored = importDiagramJson(broken);
    assert.deepEqual(restored.viewState, createDefaultViewState());
  });
});

describe("logical relationships serialization", () => {
  it("round trips the logical relationships of a diagram", () => {
    const diagram = createEmptyDiagram();
    diagram.tables = [
      {
        id: "t1",
        name: "parent",
        x: 0,
        y: 0,
        fields: [
          {
            id: "f1",
            name: "id",
            fieldType: { type: "INT" },
            fieldTypeSource: "explicit",
          },
        ],
        logical: {
          id: "le1",
          name: "Parent",
          attributes: [
            {
              id: "la1",
              name: "Id",
              logicalType: { family: "integer" },
              fieldId: "f1",
            },
          ],
        },
      },
      {
        id: "t2",
        name: "child",
        x: 0,
        y: 0,
        fields: [
          {
            id: "f2",
            name: "parent_id",
            fieldType: { type: "INT" },
            fieldTypeSource: "explicit",
          },
        ],
        logical: {
          id: "le2",
          name: "Child",
          attributes: [
            {
              id: "la2",
              name: "Parent Id",
              logicalType: { family: "integer" },
              fieldId: "f2",
            },
          ],
        },
      },
    ];
    diagram.relationships = [
      {
        id: "r1",
        name: "fk_child_parent",
        startTableId: "t2",
        startFieldId: "f2",
        endTableId: "t1",
        endFieldId: "f1",
        cardinality: "one-to-many",
      },
    ];
    diagram.logicalRelationships = [
      { id: "r1", name: "has", relationshipType: "non-identifying" },
    ];
    const restored = importDiagramJson(exportDiagramJson(diagram));
    assert.deepEqual(restored.logicalRelationships, diagram.logicalRelationships);
  });
});
