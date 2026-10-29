import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useSelectionStore } from "../../stores/selection.ts";
import {
  PANEL_BOTTOM_DEFAULT_HEIGHT,
  PANEL_BOTTOM_MAX_HEIGHT,
  PANEL_BOTTOM_MIN_HEIGHT,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from "../../stores/settings.ts";
import { useUIStore } from "../../stores/ui.ts";
import BottomPanel from "./BottomPanel.vue";

/** A diagram with errors on both diagnostic channels of the alerts tab. */
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

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(BottomPanel, { props });
}

function dragResizer(
  wrapper: ReturnType<typeof mountPanel>,
  fromClientY: number,
  toClientY: number,
): void {
  wrapper
    .find('[data-testid="bottom-panel-resizer"]')
    .trigger("mousedown", { clientY: fromClientY });
  document.dispatchEvent(new MouseEvent("mousemove", { clientY: toClientY }));
  document.dispatchEvent(new MouseEvent("mouseup"));
}

describe("BottomPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    setLocale("en");
  });

  it("renders the issues, log and history tabs but hides the trace tab", () => {
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountPanel();
    assert.ok(wrapper.find('[data-testid="tab-issues"]').exists());
    assert.ok(wrapper.find('[data-testid="tab-log"]').exists());
    assert.ok(wrapper.find('[data-testid="tab-history"]').exists());
    assert.ok(!wrapper.find('[data-testid="tab-trace"]').exists());
  });

  it("shows the trace tab in the developer mode", () => {
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountPanel({ devMode: true });
    assert.ok(wrapper.find('[data-testid="tab-trace"]').exists());
  });

  it("switches the body with the tab the user picks", async () => {
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountPanel();
    assert.ok(wrapper.find('[data-testid="alerts-tab"]').exists());
    await wrapper.find('[data-testid="tab-log"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="log-tab"]').exists());
    assert.ok(wrapper.find('[data-testid="log-empty"]').exists());
    assert.ok(!wrapper.find('[data-testid="alerts-tab"]').exists());
  });

  it("counts the errors of both channels on the issues tab badge", () => {
    useDiagramStore().setDiagram(seed());
    const wrapper = mountPanel();
    const badge = wrapper.find('[data-testid="issues-error-badge"]');
    assert.ok(badge.exists());
    const errorItems = wrapper
      .findAll('[data-testid="alert-item"]')
      .filter((item) => item.attributes("data-severity") === "error");
    assert.ok(errorItems.length >= 2, "both channels report errors");
    assert.equal(Number(badge.text()), errorItems.length);
  });

  it("shows an empty state when the diagram has no alert", () => {
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountPanel();
    assert.ok(wrapper.find('[data-testid="alerts-empty"]').exists());
  });

  it("focuses the object of an alert when the entry is clicked", async () => {
    useDiagramStore().setDiagram(seed());
    const selection = useSelectionStore();
    const wrapper = mountPanel();
    const items = wrapper.findAll('[data-testid="alert-item"]');
    assert.ok(items.length >= 2);
    await items[0].trigger("click");
    assert.ok(
      selection.selectedTableIds.length > 0 ||
        selection.selectedFields.length > 0,
    );
  });

  it("lists the entries of the undo stack with the current position marked", async () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute({ description: "Add table", execute() {}, undo() {} });
    history.execute({ description: "Rename table", execute() {}, undo() {} });
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="tab-history"]').trigger("click");
    const entries = wrapper.findAll('[data-testid="history-entry"]');
    assert.equal(entries.length, 2);
    assert.ok(entries[0].text().includes("Rename table"), "newest first");
    assert.ok(entries[1].text().includes("Add table"));
    assert.ok(wrapper.find('[data-testid="history-current"]').exists());
  });

  it("collapses to its title bar and expands again through the toggle", async () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    assert.ok(wrapper.find('[data-testid="bottom-panel-body"]').exists());
    await wrapper.find('[data-testid="bottom-panel-toggle"]').trigger("click");
    assert.equal(settings.settings.panelBottomCollapsed, true);
    assert.ok(!wrapper.find('[data-testid="bottom-panel-body"]').exists());
    const panel = wrapper.find('[data-testid="bottom-panel"]');
    assert.ok(panel.attributes("style")?.includes("height: 28px"));
    await wrapper.find('[data-testid="bottom-panel-toggle"]').trigger("click");
    assert.equal(settings.settings.panelBottomCollapsed, false);
  });

  it("starts collapsed when the settings say so", () => {
    const settings = useSettingsStore();
    settings.update({ panelBottomCollapsed: true });
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountPanel();
    assert.ok(!wrapper.find('[data-testid="bottom-panel-body"]').exists());
  });

  it("drags the resizer to grow the height and persists it", () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    dragResizer(wrapper, 300, 200);
    assert.equal(settings.settings.panelBottomHeight, 268);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    assert.equal(stored.panelBottomHeight, 268);
  });

  it("clamps the height of a drag to the bounds", () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    dragResizer(wrapper, 300, -2000);
    assert.equal(settings.settings.panelBottomHeight, PANEL_BOTTOM_MAX_HEIGHT);
    dragResizer(wrapper, 300, 3000);
    assert.equal(settings.settings.panelBottomHeight, PANEL_BOTTOM_MIN_HEIGHT);
  });

  it("restores the default height when the resizer is double clicked", async () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    settings.update({ panelBottomHeight: 300 });
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="bottom-panel-resizer"]').trigger("dblclick");
    assert.equal(settings.settings.panelBottomHeight, PANEL_BOTTOM_DEFAULT_HEIGHT);
  });

  it("does not auto expand on new errors but shows a badge and a toast", async () => {
    const settings = useSettingsStore();
    settings.update({ panelBottomCollapsed: true });
    const diagram = useDiagramStore();
    diagram.setDiagram(seedValid());
    const ui = useUIStore();
    const wrapper = mountPanel();
    assert.ok(ui.lastNotification === null);
    diagram.setDiagram(seed());
    await wrapper.vm.$nextTick();
    assert.equal(settings.settings.panelBottomCollapsed, true, "no auto expand");
    assert.ok(ui.lastNotification !== null, "a one-time toast was raised");
    assert.ok(wrapper.find('[data-testid="issues-error-badge"]').exists());
  });

  it("raises the toast only once per error arrival", async () => {
    const diagram = useDiagramStore();
    diagram.setDiagram(seed());
    const ui = useUIStore();
    const wrapper = mountPanel();
    // Read through a function: an assertion on `ui.lastNotification === null`
    // would narrow the property for the rest of the test.
    const notification = () => ui.lastNotification;
    assert.ok(notification() === null, "no toast on the initial state");
    diagram.setDiagram(seedValid());
    await wrapper.vm.$nextTick();
    assert.ok(notification() === null);
    diagram.setDiagram(seed());
    await wrapper.vm.$nextTick();
    const first = notification()?.id;
    assert.ok(first !== undefined);
    diagram.setDiagram({ ...seed(), title: "shop2" });
    await wrapper.vm.$nextTick();
    assert.equal(notification()?.id, first, "errors stayed, no new toast");
  });

  it("maximizes over the canvas and restores the normal height", async () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    settings.update({ panelBottomHeight: 200 });
    const wrapper = mountPanel();
    await wrapper
      .find('[data-testid="bottom-panel-maximize"]')
      .trigger("click");
    const panel = () => wrapper.find('[data-testid="bottom-panel"]');
    assert.equal(panel().attributes("data-maximized"), "true");
    assert.ok(wrapper.find('[data-testid="bottom-panel-body"]').exists());
    assert.ok(
      !wrapper.find('[data-testid="bottom-panel-resizer"]').exists(),
      "the maximized panel does not resize",
    );
    assert.equal(
      settings.settings.panelBottomHeight,
      200,
      "maximizing does not touch the persisted height",
    );
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    assert.equal(stored.maximized, undefined);
    await wrapper
      .find('[data-testid="bottom-panel-maximize"]')
      .trigger("click");
    assert.equal(panel().attributes("data-maximized"), undefined);
    assert.ok(wrapper.find('[data-testid="bottom-panel-resizer"]').exists());
  });

  it("expands a collapsed panel when it is maximized", async () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    settings.update({ panelBottomCollapsed: true });
    const wrapper = mountPanel();
    assert.ok(!wrapper.find('[data-testid="bottom-panel-body"]').exists());
    await wrapper
      .find('[data-testid="bottom-panel-maximize"]')
      .trigger("click");
    assert.equal(settings.settings.panelBottomCollapsed, false);
    assert.ok(wrapper.find('[data-testid="bottom-panel-body"]').exists());
    assert.equal(
      wrapper.find('[data-testid="bottom-panel"]').attributes("data-maximized"),
      "true",
    );
  });

  it("returns a maximized panel to the collapsed state through the toggle", async () => {
    useDiagramStore().setDiagram(seedValid());
    const settings = useSettingsStore();
    const wrapper = mountPanel();
    await wrapper
      .find('[data-testid="bottom-panel-maximize"]')
      .trigger("click");
    await wrapper.find('[data-testid="bottom-panel-toggle"]').trigger("click");
    assert.equal(settings.settings.panelBottomCollapsed, true);
    assert.ok(!wrapper.find('[data-testid="bottom-panel-body"]').exists());
    assert.equal(
      wrapper.find('[data-testid="bottom-panel"]').attributes("data-maximized"),
      undefined,
    );
  });

  it("lists the recent commands in the log tab and clears only the list", async () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute({ description: "Add table", execute() {}, undo() {} });
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="tab-log"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="log-list"]').exists());
    assert.ok(wrapper.text().includes("Add table"));
    const depth = history.depth;
    await wrapper.find('[data-testid="log-clear"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="log-empty"]').exists());
    assert.equal(history.depth, depth, "the undo stack is untouched");
  });
});
