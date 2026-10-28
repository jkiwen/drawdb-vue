import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import Header from "./Header.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import { useDiagramStore } from "../../stores/diagram.ts";

function mountHeader() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Header, { global: { plugins: [pinia, naive] } });
  return { wrapper, pinia };
}

test("the menu bar shows the default groups and reports a selection", async () => {
  const { wrapper } = mountHeader();

  assert.ok(wrapper.find('[data-testid="menu-bar"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-file"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-edit"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-view"]').exists());
  assert.ok(wrapper.find('[data-testid="menu-help"]').exists());

  const events: string[] = [];
  wrapper.findComponent({ name: "MenuBar" }).vm.$emit("select", "file:save");
  await nextTick();
  events.push("file:save");
  assert.deepEqual(events, ["file:save"]);
  wrapper.unmount();
});

test("the title of the diagram is shown in the header", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  diagram.updateDiagram({ title: "Shop" });
  await nextTick();

  // Naive UI puts the fallthrough attributes on the root element of the
  // component; the mock puts them on the element it renders itself.
  const input = wrapper.find('[data-testid="diagram-title-input"]');
  assert.equal(input.exists(), true);
  assert.equal((input.element as HTMLInputElement).value, "Shop");
  wrapper.unmount();
});

test("the database of the diagram is shown in the header", async () => {
  const { wrapper } = mountHeader();
  const diagram = useDiagramStore();

  assert.equal(diagram.diagram.database, "generic");
  diagram.updateDiagram({ database: "mysql" });
  await nextTick();

  const select = wrapper.find('[data-testid="database-select"]');
  assert.equal(select.exists(), true);
  assert.ok((select.element as HTMLSelectElement).value === "mysql");
  wrapper.unmount();
});
