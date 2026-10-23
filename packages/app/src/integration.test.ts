import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { MemoryStorageAdapter, createEmptyDiagram } from "@drawdb/core";
import App from "./App.vue";
import { createAppRouter } from "./router/index.ts";
import { setStorage } from "./services/storage.ts";

/** The instance of the editor, as it is exposed by the SDK. */
interface EditorInstance {
  save(): Promise<void>;
  exportSql(): string;
  exportDbml(): string;
  importSql(sql: string, database?: string): unknown;
  getDiagram(): { tables: { name: string }[] };
}

/** Mount the application with a router that keeps its history in memory. */
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

/** The instance of the editor of the application. */
function editor(wrapper: Awaited<ReturnType<typeof mountApp>>["wrapper"]) {
  return wrapper.findComponent({ name: "DrawDBEditor" }).vm as unknown as EditorInstance;
}

test("draws a table that the user added in the editor", async () => {
  const { wrapper } = await mountApp("/editor/d1", async (storage) => {
    await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
  });

  assert.ok(wrapper.find('[data-testid="canvas"]').exists());

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await settle();

  const tables = wrapper.find('[data-testid="canvas"]').findAll('[data-testid^="table-"]');
  assert.equal(tables.length, 1);
});

test("keeps the table when the diagram is saved and loaded again", async () => {
  const { wrapper, storage } = await mountApp(
    "/editor/d1",
    async (storage) => {
      await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
    },
  );

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await settle();

  await editor(wrapper).save();
  await settle();

  const stored = await storage.load("d1");
  assert.ok(stored);
  assert.equal(stored.tables.length, 1);

  // The editor is mounted again, with the diagram that was stored.
  const second = await mountApp("/editor/d1", async (storage) => {
    await storage.save(stored);
  });

  const tables = second.wrapper.find('[data-testid="canvas"]').findAll('[data-testid^="table-"]');
  assert.equal(tables.length, 1);
});

test("exports the diagram of the editor as SQL", async () => {
  const { wrapper } = await mountApp("/editor/d1", async (storage) => {
    await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
  });

  await editor(wrapper).importSql(
    "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255));",
    "mysql",
  );
  await settle();

  const sql = editor(wrapper).exportSql();
  assert.match(sql, /CREATE TABLE/);
  assert.match(sql, /users/);
});

test("undoes the table that the user added", async () => {
  const { wrapper } = await mountApp("/editor/d1", async (storage) => {
    await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));
  });

  await wrapper.find('[data-testid="add-table-btn"]').trigger("click");
  await settle();
  assert.equal(wrapper.find('[data-testid="canvas"]').findAll('[data-testid^="table-"]').length, 1);

  await wrapper.find('[data-testid="undo-btn"]').trigger("click");
  await settle();

  assert.equal(wrapper.find('[data-testid="canvas"]').findAll('[data-testid^="table-"]').length, 0);
});
