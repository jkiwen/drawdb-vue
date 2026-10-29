import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useSelectionStore } from "../../stores/selection.ts";
import type { AlertItem } from "./use-alerts.ts";
import { MAX_ALERTS, mergeAlerts, useAlerts } from "./use-alerts.ts";

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
          { id: "f1", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
        ],
        primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f1" }] },
      },
    ],
  };
}

/**
 * A mysql diagram whose only physical type is not in the dialect while the
 * logical mapping suggests VARCHAR: the diagnostic is fixable (plan 6.5).
 */
function seedFixable(): Diagram {
  return {
    ...seed(),
    database: "mysql",
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
            {
              id: "a_f1",
              name: "id",
              logicalType: { family: "string" },
              fieldId: "f1",
            },
          ],
        },
        fields: [
          {
            id: "f1",
            name: "id",
            fieldType: { type: "GEOGRAPHY" },
            fieldTypeSource: "mapped",
          },
        ],
        primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f1" }] },
      },
    ],
  } as Diagram;
}

/** Builds one fabricated alert for the merge tests. */
function alert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    id: "a",
    source: "dialect",
    severity: "error",
    code: "CODE",
    label: "label",
    target: { tableId: "t1", fieldId: "f1" },
    fixable: false,
    ...overrides,
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

  it("marks a fixable diagnostic and carries its suggestion", () => {
    useDiagramStore().setDiagram(seedFixable());
    const { alerts } = useAlerts();
    const fixable = alerts.value.find(
      (item) => item.code === "TYPE_NOT_IN_DIALECT" && item.fixable,
    );
    assert.ok(fixable, "the diagnostic carries fixable");
    assert.equal(fixable.suggestion?.type, "VARCHAR");
  });

  it("applies the suggestion through the diagram command stack", () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seedFixable());
    const history = useHistoryStore();
    const { alerts, applyFix } = useAlerts();
    const fixable = alerts.value.find((item) => item.fixable);
    assert.ok(fixable, "a fixable alert is present");
    applyFix(fixable);
    const field = diagram.diagram.tables[0].fields[0];
    assert.equal(field.fieldType.type, "VARCHAR");
    assert.equal(field.fieldTypeSource, "explicit");
    assert.equal(history.depth, 1, "the fix is an undoable command");
    history.undo();
    assert.equal(
      diagram.diagram.tables[0].fields[0].fieldType.type,
      "GEOGRAPHY",
    );
  });

  it("ignores applyFix on an alert without a fix", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts, applyFix } = useAlerts();
    const plain = alerts.value.find((item) => !item.fixable);
    assert.ok(plain, "a non-fixable alert is present");
    const before = useDiagramStore().revision;
    applyFix(plain);
    assert.equal(useDiagramStore().revision, before);
  });

  it("counts the alerts of every severity", () => {
    useDiagramStore().setDiagram(seed());
    const { alerts, errorCount, warningCount, infoCount } = useAlerts();
    const count = (severity: AlertItem["severity"]) =>
      alerts.value.filter((item) => item.severity === severity).length;
    assert.equal(errorCount.value, count("error"));
    assert.equal(warningCount.value, count("warning"));
    assert.equal(infoCount.value, count("info"));
  });

  it("deduplicates alerts by code and target and keeps the newest", () => {
    const merged = mergeAlerts([
      alert({ id: "1", code: "A", target: { tableId: "t1", fieldId: "f1" } }),
      alert({ id: "2", code: "A", target: { tableId: "t1", fieldId: "f1" } }),
      alert({ id: "3", code: "A", target: { tableId: "t1", fieldId: "f2" } }),
    ]);
    assert.deepEqual(
      merged.map((item) => item.id),
      ["1", "3"],
    );
  });

  it("caps the stored alerts at a thousand, keeping the newest first", () => {
    const items = Array.from({ length: MAX_ALERTS + 5 }, (_, index) =>
      alert({
        id: String(index),
        target: { tableId: "t1", fieldId: `f${index}` },
      }),
    );
    const merged = mergeAlerts(items);
    assert.equal(merged.length, MAX_ALERTS);
    assert.equal(merged[0].id, "0");
    assert.equal(merged[MAX_ALERTS - 1].id, String(MAX_ALERTS - 1));
  });
});
