import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useSelectionStore } from "../../stores/selection.ts";
import IssuesTab from "./IssuesTab.vue";
import SidePanel from "./SidePanel.vue";

/** A diagram with an error, a warning and a duplicate table name. */
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
        fields: [
          { id: "f1", name: "", type: "INTEGER" },
          { id: "f2", name: "email", type: "" },
        ],
      },
      { id: "t2", name: "orders", x: 300, y: 0, fields: [] },
    ],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
  } as Diagram;
}

describe("IssuesTab", () => {
  /** Mounts the tab; the issues come from the diagram store. */
  function mountIssues() {
    return mount(IssuesTab, { global: { plugins: [naive] } });
  }

  it("the issues tab lists the issues", () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram(seed());
    const wrapper = mountIssues();
    assert.ok(wrapper.find('[data-testid="issues-list"]').exists());
    assert.ok(wrapper.findAll(".issue-item").length > 0);
  });

  it("the issues are grouped by severity", () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram(seed());
    const wrapper = mountIssues();
    assert.ok(wrapper.find('[data-testid="issues-errors"]').exists());
    assert.ok(wrapper.find('[data-testid="issues-warnings"]').exists());
  });

  it("clicking an issue selects the field", async () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram(seed());
    const selection = useSelectionStore();
    const wrapper = mountIssues();
    const items = wrapper.findAll('[data-testid="issue-item"]');
    await items[0].trigger("click");
    assert.equal(selection.selectedFields[0]?.tableId, "t1");
    assert.equal(selection.selectedFields[0]?.fieldId, "f1");
  });

  it("clicking an issue scrolls the canvas to the object", async () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram(seed());
    const selection = useSelectionStore();
    const wrapper = mountIssues();
    selection.scrollX = 700;
    const items = wrapper.findAll('[data-testid="issue-item"]');
    await items[items.length - 1].trigger("click");
    assert.equal(selection.scrollX, 0);
  });

  it("the issues tab shows an empty state for a valid diagram", () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram({
      ...seed(),
      tables: [
        {
          id: "t1",
          name: "users",
          x: 0,
          y: 0,
          fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
        },
      ],
    });
    const wrapper = mount(IssuesTab, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="issues-empty"]').exists());
  });

  it("the issues tab is reachable from the tab bar", () => {
    setActivePinia(createPinia());
    setLocale("en");
    useDiagramStore().setDiagram(seed());
    const wrapper = mount(SidePanel, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="issues-tab"]').exists());
  });
});
