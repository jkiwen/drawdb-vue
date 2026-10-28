import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../i18n/index.ts";
import { useDiagramStore } from "../stores/diagram.ts";
import { useSelectionStore } from "../stores/selection.ts";
import { useFocusIssue } from "../stores/selection-actions.ts";
import { useIssues } from "./use-issues.ts";

/** A diagram with a warning and an error, so that both groups are covered. */
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

describe("use-issues", () => {
  it("useIssues returns no issue for a valid diagram", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram({
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
    });
    const issues = useIssues();
    assert.equal(issues.issues.value.length, 0);
  });

  it("useIssues groups the issues by severity", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const issues = useIssues();
    assert.ok(issues.errors.value.length > 0);
    assert.ok(issues.warnings.value.length > 0);
  });

  it("useIssues localizes the message with the locale of the sdk", () => {
    setActivePinia(createPinia());
    setLocale("zh-CN");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const issues = useIssues();
    const message = issues.errors.value[0]?.label ?? "";
    assert.notEqual(message, issues.errors.value[0]?.message);
    assert.ok(message.length > 0);
    setLocale("en");
  });

  it("useIssues recomputes when the diagram changes", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const issues = useIssues();
    const before = issues.issues.value.length;
    diagram.addTable({ id: "t3", name: "users", x: 600, y: 0, fields: [] } as never);
    assert.notEqual(issues.issues.value.length, before);
  });

  it("useIssues reports the table of an issue", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const issues = useIssues();
    const issue = issues.errors.value.find((entry) => entry.params?.table === "users");
    assert.ok(issue);
    assert.equal(issue.tableId, "t1");
  });

  it("focusIssue selects the table of the issue", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const selection = useSelectionStore();
    const focusIssue = useFocusIssue();
    focusIssue({ tableId: "t1" });
    assert.equal(selection.selectedTableIds[0], "t1");
  });

  it("focusIssue selects the field of an issue that carries one", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const selection = useSelectionStore();
    const focusIssue = useFocusIssue();
    focusIssue({ tableId: "t1", fieldId: "f1" });
    assert.equal(selection.selectedFields[0]?.tableId, "t1");
  });

  it("focusIssue scrolls the canvas to the table", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const selection = useSelectionStore();
    const focusIssue = useFocusIssue();
    focusIssue({ tableId: "t1" });
    assert.equal(selection.scrollX, 0);
    assert.equal(selection.scrollY, 0);
  });

  it("focusIssue leaves the scroll position when the table is gone", () => {
    setActivePinia(createPinia());
    setLocale("en");
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const selection = useSelectionStore();
    const focusIssue = useFocusIssue();
    selection.scrollX = 900;
    selection.scrollY = 900;
    focusIssue({ tableId: "missing" });
    assert.equal(selection.scrollX, 900);
    assert.equal(selection.scrollY, 900);
  });
});
