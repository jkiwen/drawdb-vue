import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { MemoryStorageAdapter, createEmptyDiagram } from "@drawdb/core";
import App from "./App.vue";
import { createAppRouter } from "./router/index.ts";
import { setStorage } from "./services/storage.ts";

/**
 * Mount the application with a router that keeps its history in memory.
 *
 * The storage of the application is replaced with the memory adapter, so that
 * the specifications do not write into the browser.
 */
async function mountApp(
  path = "/",
  prepare?: (storage: MemoryStorageAdapter) => Promise<void>,
) {
  const storage = new MemoryStorageAdapter();
  setStorage(storage);
  await prepare?.(storage);

  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();

  const pinia = createPinia();
  const wrapper = mount(App, { global: { plugins: [pinia, router] } });
  await wrapper.vm.$nextTick();
  await settle();

  return { wrapper, router, storage };
}

/** Wait for the pending promises and the pending renders. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("renders the view of the router", async () => {
  const { wrapper } = await mountApp();
  assert.ok(wrapper.find('[data-testid="home-view"]').exists());
  assert.ok(wrapper.find('[data-testid="brand"]').exists());
});

test("lists the stored diagrams", async () => {
  const { wrapper } = await mountApp("/", async (storage) => {
    await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
    await storage.save(createEmptyDiagram({ id: "d2", title: "Analytics" }));
  });

  const links = wrapper.findAll('[data-testid="diagram-link"]');
  assert.equal(links.length, 2);
  assert.match(links[0].text(), /Billing/);
  assert.match(links[1].text(), /Analytics/);
  assert.ok(!wrapper.find('[data-testid="home-empty"]').exists());
});

test("deletes a stored diagram", async () => {
  const { wrapper } = await mountApp("/", async (storage) => {
    await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
  });

  await wrapper.find('[data-testid="remove-diagram"]').trigger("click");
  await settle();

  assert.equal(wrapper.findAll('[data-testid="diagram-link"]').length, 0);
  assert.ok(wrapper.find('[data-testid="home-empty"]').exists());
});

test("opens the editor of a diagram", async () => {
  const { wrapper, router } = await mountApp(
    "/editor/d1",
    async (storage) => {
      const diagram = createEmptyDiagram({ id: "d1", title: "Billing" });
      diagram.tables = [
        {
          id: "t1",
          name: "invoices",
          x: 0,
          y: 0,
          fields: [{ id: "f1", name: "id", type: "INTEGER", primary: true }],
        },
      ];
      await storage.save(diagram);
    },
  );

  assert.ok(wrapper.find('[data-testid="editor-view"]').exists());
  assert.ok(wrapper.find('[data-testid="canvas"]').exists());
  assert.equal(router.currentRoute.value.name, "editor-diagram");
});

test("shows the templates", async () => {
  const { wrapper, router } = await mountApp("/templates");
  await settle();

  const links = wrapper.findAll('[data-testid="template-link"]');
  assert.equal(links.length, 2);
  assert.match(links[0].text(), /Blog/);
  assert.equal(router.currentRoute.value.name, "templates");
});

test("opens a template in the editor", async () => {
  const { wrapper, router, storage } = await mountApp("/templates/blog");
  await settle();

  assert.equal(wrapper.find('[data-testid="template-name"]').text(), "Blog");

  await wrapper.find('[data-testid="use-template"]').trigger("click");
  await settle();

  assert.equal(router.currentRoute.value.name, "editor-diagram");
  const diagrams = await storage.list();
  assert.equal(diagrams.length, 1);
  assert.equal(diagrams[0].title, "Blog");
});
