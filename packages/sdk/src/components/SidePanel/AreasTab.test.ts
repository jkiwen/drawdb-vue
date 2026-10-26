import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import AreasTab from "./AreasTab.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { AREA_DESCRIPTION_MAX_LENGTH, AREA_NAME_MAX_LENGTH } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";

/** The editing of the name and the description of an area. */

function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "postgres",
    tables: [],
    relationships: [],
    notes: [],
    subjectAreas: [
      { id: "a1", name: "core", description: "old", x: 0, y: 0, width: 100, height: 100 },
    ],
    types: [],
    enums: [],
    views: [],
    sqlHeader: "",
    metadata: {},
  } as Diagram;
}

function setup(diagram: Diagram) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useDiagramStore(pinia);
  store.setDiagram(diagram);
  return store;
}

/**
 * The inputs of the editor are native form elements, so a spec drives them
 * with the events a browser would send: `input` for what a user types and
 * `change` for what a user commits.
 */
function setValue(wrapper: ReturnType<typeof mount>, testid: string, value: string): void {
  const field = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(field.exists(), `${testid} should exist`);
  const form = field.element as HTMLInputElement | HTMLTextAreaElement;
  form.focus();
  form.value = value;
  form.dispatchEvent(new window.Event("input", { bubbles: true }));
  form.dispatchEvent(new window.Event("change", { bubbles: true }));
}

async function openEditor(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('[data-testid="edit-area-a1"]').trigger("click");
  await nextTick();
}

describe("AreasTab", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("lists the areas", () => {
    setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    assert.ok(wrapper.find('[data-testid="area-item-a1"]').exists());
  });

  it("opens an editor with the current name and description", async () => {
    setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    const name = wrapper.find('[data-testid="area-name-input-a1"]');
    const description = wrapper.find('[data-testid="area-description-input-a1"]');
    assert.ok(name.exists());
    assert.ok(description.exists());
    assert.equal((name.element as HTMLInputElement).value, "core");
    assert.equal((description.element as HTMLTextAreaElement).value, "old");
  });

  it("updates the name of the area", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-name-input-a1", "billing");
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].name, "billing");
  });

  it("updates the description of the area", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-description-input-a1", "The billing tables");
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].description, "The billing tables");
  });

  it("clears the description when it is saved empty", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-description-input-a1", "");
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].description, undefined);
  });

  it("shows the description under the name", async () => {
    setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await nextTick();
    const description = wrapper.find('[data-testid="area-description-a1"]');
    assert.ok(description.exists());
    assert.equal(description.text(), "old");
  });

  it("rejects an empty name", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-name-input-a1", "   ");
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].name, "core");
    assert.ok(wrapper.find('[data-testid="area-error-a1"]').exists());
  });

  it("rejects a name longer than the limit", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-name-input-a1", "a".repeat(AREA_NAME_MAX_LENGTH + 1));
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].name, "core");
    assert.ok(wrapper.find('[data-testid="area-error-a1"]').exists());
  });

  it("rejects a description longer than the limit", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(
      wrapper,
      "area-description-input-a1",
      "a".repeat(AREA_DESCRIPTION_MAX_LENGTH + 1),
    );
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].description, "old");
    assert.ok(wrapper.find('[data-testid="area-error-a1"]').exists());
  });

  it("leaves the area unchanged when the edit is cancelled", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-name-input-a1", "billing");
    await wrapper.find('[data-testid="cancel-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas[0].name, "core");
    assert.equal(wrapper.find('[data-testid="area-name-input-a1"]').exists(), false);
  });

  it("the edit can be undone", async () => {
    const diagram = setup(seed());
    const history = useHistoryStore();
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await openEditor(wrapper);
    setValue(wrapper, "area-name-input-a1", "billing");
    setValue(wrapper, "area-description-input-a1", "The billing tables");
    await wrapper.find('[data-testid="save-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(history.canUndo, true);
    history.undo();
    await nextTick();
    assert.equal(diagram.areas[0].name, "core");
    assert.equal(diagram.areas[0].description, "old");
  });

  it("an area can still be removed", async () => {
    const diagram = setup(seed());
    const wrapper = mount(AreasTab, { global: { plugins: [naive] } });
    await wrapper.find('[data-testid="remove-area-a1"]').trigger("click");
    await nextTick();
    assert.equal(diagram.areas.length, 0);
  });
});
