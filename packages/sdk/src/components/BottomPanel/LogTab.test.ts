import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import LogTab from "./LogTab.vue";

/** A clean diagram: the log only shows the commands the test executes. */
function seedValid(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "generic",
    tables: [],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
  } as Diagram;
}

/** A command with a description; the log reads the descriptions only. */
function command(description: string) {
  return { description, execute() {}, undo() {} };
}

function mountTab() {
  return mount(LogTab);
}

describe("LogTab", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    setLocale("en");
  });

  it("lists the command descriptions newest first", () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    const wrapper = mountTab();
    const entries = wrapper.findAll('[data-testid="log-entry"]');
    assert.equal(entries.length, 2);
    assert.ok(entries[0].text().includes("Rename table"));
    assert.ok(entries[1].text().includes("Add table"));
    assert.ok(wrapper.find('[data-testid="log-list"]').exists());
  });

  it("shows an empty state without commands", () => {
    useDiagramStore().setDiagram(seedValid());
    const wrapper = mountTab();
    assert.ok(wrapper.find('[data-testid="log-empty"]').exists());
    assert.ok(!wrapper.find('[data-testid="log-list"]').exists());
  });

  it("keeps the undone commands in the log as text", () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    history.undo();
    const wrapper = mountTab();
    assert.equal(wrapper.findAll('[data-testid="log-entry"]').length, 2);
  });

  it("clears only the panel list, never the undo stack", async () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    const wrapper = mountTab();
    assert.equal(wrapper.findAll('[data-testid="log-entry"]').length, 2);
    await wrapper.find('[data-testid="log-clear"]').trigger("click");
    assert.equal(wrapper.findAll('[data-testid="log-entry"]').length, 0);
    assert.ok(wrapper.find('[data-testid="log-empty"]').exists());
    assert.equal(history.depth, 2, "the undo stack is untouched");
  });

  it("shows commands that arrive after a clear", async () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    history.execute(command("Add table"));
    const wrapper = mountTab();
    await wrapper.find('[data-testid="log-clear"]').trigger("click");
    history.execute(command("Rename table"));
    await wrapper.vm.$nextTick();
    const entries = wrapper.findAll('[data-testid="log-entry"]');
    assert.equal(entries.length, 1);
    assert.ok(entries[0].text().includes("Rename table"));
  });

  it("caps the list at a thousand entries", () => {
    useDiagramStore().setDiagram(seedValid());
    const history = useHistoryStore();
    for (let index = 0; index < 1002; index += 1) {
      history.execute(command(`Command ${index}`));
    }
    const wrapper = mountTab();
    assert.equal(wrapper.findAll('[data-testid="log-entry"]').length, 1000);
    assert.ok(
      wrapper.findAll('[data-testid="log-entry"]')[0].text().includes("Command 1001"),
      "newest first",
    );
  });
});
