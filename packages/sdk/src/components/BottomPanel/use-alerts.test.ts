import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useSelectionStore } from "../../stores/selection.ts";
import { useAlerts } from "./use-alerts.ts";

/**
 * A diagram that produces both channels of the alerts tab: the empty field
 * name and the missing primary key are DiagramIssue entries, the empty
 * physical type is a TYPE_NOT_IN_DIALECT dialect diagnostic.
 */
function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "generic",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        logical: { id: "l_t1", name: "users", attributes: [] },
        fields: [
          { id: "f1", name: "", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
          { id: "f2", name: "email", fieldType: { type: "" }, fieldTypeSource: "explicit" },
        ],
      },
      { id: "t2", name: "orders", x: 300, y: 0, logical: { id: "l_t2", name: "orders", attributes: [] }, fields: [] },
    ],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
  } as Diagram;
}

function seedValid(): Diagram {
  return {
    ...seed(),
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        logical: {
          id: "l_t1",
          name: "users",
          attributes: [
            { id: "a_f1", name: "id", logicalType: { family: "integer" }, fieldId: "f1" },
          ],
        },
        fields: [
          { id: "f1", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
        ],
      },
    ],
  };
}

describe("use-alerts", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setLocale("en");
  });

  it("reports no alert for a valid diagram", () => {
    useDiagramStore().setDiagram(seedValid());
    const { alerts, errorCount } = useAlerts();
    assert.equal(alerts.value.length, 0);
    assert.equal(errorCount.value, 0);
  });

  it("merges the diagram issues and the dialect diagnostics", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts } = useAlerts();
    const sources = new Set(alerts.value.map((alert) => alert.source));
    assert.ok(sources.has("diagram"), "the diagram channel is missing");
    assert.ok(sources.has("dialect"), "the dialect channel is missing");
  });

  it("lists the errors before the warnings", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts, errorCount } = useAlerts();
    assert.ok(errorCount.value >= 2, "both channels report errors");
    const ranks = alerts.value.map((alert) =>
      alert.severity === "error" ? 0 : alert.severity === "warning" ? 1 : 2,
    );
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  });

  it("carries the code of the dialect diagnostic", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts } = useAlerts();
    const dialect = alerts.value.find((alert) => alert.source === "dialect");
    assert.equal(dialect?.code, "TYPE_NOT_IN_DIALECT");
    assert.equal(dialect?.severity, "error");
  });

  it("maps the scope of a dialect diagnostic to a focus target", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts } = useAlerts();
    const dialect = alerts.value.find((alert) => alert.source === "dialect");
    assert.equal(dialect?.target?.tableId, "t1");
    assert.equal(dialect?.target?.fieldId, "f2");
  });

  it("focuses the object of an alert through the ui store", () => {
    useDiagramStore().setDiagram(seed());
    const selection = useSelectionStore();
    const { alerts, focus } = useAlerts();
    const dialect = alerts.value.find((alert) => alert.source === "dialect")!;
    focus(dialect);
    assert.deepEqual(selection.selectedFields, [{ tableId: "t1", fieldId: "f2" }]);
  });

  it("recomputes when the diagram changes", () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seedValid());
    const { alerts, errorCount } = useAlerts();
    assert.equal(errorCount.value, 0);
    diagram.setDiagram(seed());
    assert.ok(alerts.value.length > 0);
    assert.ok(errorCount.value > 0);
  });
});
