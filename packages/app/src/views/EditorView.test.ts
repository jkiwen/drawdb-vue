import { test } from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { MemoryStorageAdapter, createEmptyDiagram } from "@drawdb/core";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import { naive } from "../../../../scripts/naive-ui-mock.mjs";
import App from "../App.vue";
import { createAppRouter } from "../router/index.ts";
import { setStorage } from "../services/storage.ts";
import { DEMO_ADD_NOTE_COMMAND } from "../services/demo-plugin.ts";

/** The bridge the end to end tests use. */
interface Bridge {
  editor: unknown;
  exportSql(): string;
  exportDbml(): string;
  importSql(sql: string, database?: string): unknown;
  runCommand(key: string): boolean;
  getDiagram(): { notes: unknown[]; tables: unknown[] };
  validate(): unknown[];
  autoArrange(): void;
}

/** Mounts the application on the route of the editor. */
async function mountEditor() {
  const storage = new MemoryStorageAdapter();
  setStorage(storage);
  await storage.save(createEmptyDiagram({ id: "d1", title: "Billing" }));

  const router = createAppRouter(createMemoryHistory());
  await router.push("/editor/d1");
  await router.isReady();

  const wrapper = mount(App, {
    global: { plugins: [createPinia(), router, naive], components: { DrawDBEditor } },
  });
  await wrapper.vm.$nextTick();
  await settle();

  return { wrapper, router };
}

/** Waits for the pending promises and the pending renders. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The bridge on the window of the test. */
function bridge(): Bridge | undefined {
  return (globalThis as unknown as Record<string, Bridge>).__DRAWDB__;
}

test("the view of the editor publishes the bridge on the window", async () => {
  await mountEditor();

  const published = bridge();
  assert.ok(published);
  assert.equal(typeof published.exportSql, "function");
  assert.equal(typeof published.exportDbml, "function");
  assert.equal(typeof published.importSql, "function");
  assert.equal(typeof published.runCommand, "function");
  assert.equal(typeof published.getDiagram, "function");
  assert.equal(typeof published.validate, "function");
  assert.equal(typeof published.autoArrange, "function");
  assert.ok(published.editor);
});

test("the bridge of the editor exports the diagram of the SDK", async () => {
  await mountEditor();

  const published = bridge();
  assert.ok(published);

  published.importSql("CREATE TABLE users (id INT PRIMARY KEY);", "mysql");
  await settle();

  assert.match(published.exportSql(), /CREATE TABLE/);
  assert.match(published.exportDbml(), /users/);
  assert.equal(published.getDiagram().tables.length, 1);
});

test("the bridge of the editor runs the command of the demo plugin", async () => {
  await mountEditor();

  const published = bridge();
  assert.ok(published);

  const before = published.getDiagram().notes.length;
  assert.equal(published.runCommand(DEMO_ADD_NOTE_COMMAND), true);
  await settle();

  assert.equal(published.getDiagram().notes.length, before + 1);
  assert.equal(published.runCommand("does.not.exist"), false);
});

test("the bridge of the editor is removed when the view is left", async () => {
  const { wrapper, router } = await mountEditor();
  assert.ok(bridge());

  await router.push("/");
  await wrapper.vm.$nextTick();

  assert.equal(bridge(), undefined);
});

test("the menu of the editor opens the home view", async () => {
  const { wrapper, router } = await mountEditor();

  wrapper.findComponent(DrawDBEditor).vm.$emit("menu", "file:open");
  await settle();

  assert.equal(router.currentRoute.value.path, "/");
});

test("the menu of the editor opens a new diagram", async () => {
  const { wrapper, router } = await mountEditor();

  wrapper.findComponent(DrawDBEditor).vm.$emit("menu", "file:new");
  await settle();

  assert.equal(router.currentRoute.value.path, "/editor");
});

test("the menu of the editor opens the documentation", async () => {
  const { wrapper } = await mountEditor();
  const opened: string[] = [];
  const host = globalThis as unknown as { window: { open: unknown } };
  const open = host.window.open;
  host.window.open = (url: string) => {
    opened.push(url);
    return null;
  };

  try {
    wrapper.findComponent(DrawDBEditor).vm.$emit("menu", "help:documentation");
    await settle();
  } finally {
    host.window.open = open;
  }

  assert.deepEqual(opened, ["https://drawdb.app"]);
});

test("the export of the editor downloads the diagram as json", async () => {
  const { wrapper } = await mountEditor();
  const download = withDownload(() => {
    wrapper
      .findComponent(DrawDBEditor)
      .vm.$emit("export-json", JSON.stringify({ title: "Billing" }));
  });
  await settle();

  assert.equal(download.name, "billing.json");
  assert.equal(download.clicked, true);
});

/** A download the test can look at instead of the browser. */
interface Download {
  name: string;
  text: string;
  clicked: boolean;
}

/** Stubs the parts of the browser the download goes through. */
function withDownload(run: (download: Download) => void) {
  const download: Download = { name: "", text: "", clicked: false };
  const url = {
    createObjectURL: (blob: Blob) => {
      void blob.text().then((text) => {
        download.text = text;
      });
      return "blob:test";
    },
    revokeObjectURL: () => undefined,
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
    download.name = this.download;
    download.clicked = true;
  };
  (globalThis as { URL: unknown }).URL = url;
  try {
    run(download);
  } finally {
    HTMLAnchorElement.prototype.click = click;
  }
  return download;
}
