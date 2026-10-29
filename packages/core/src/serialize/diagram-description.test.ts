import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import { exportDiagramJson } from "./export.ts";
import { importDiagramJson } from "./import.ts";

describe("the description of a diagram", () => {
  it("travels with the saved diagram", () => {
    const diagram = createEmptyDiagram({ title: "Sales" });
    diagram.description = "The selling side of the shop.";

    const json = exportDiagramJson(diagram);
    assert.equal(JSON.parse(json).description, "The selling side of the shop.");

    const back = importDiagramJson(json);
    assert.equal(back.description, "The selling side of the shop.");
  });

  it("stays absent when the diagram has none", () => {
    const back = importDiagramJson(exportDiagramJson(createEmptyDiagram({ title: "Sales" })));
    assert.equal(back.description, undefined);
  });
});
