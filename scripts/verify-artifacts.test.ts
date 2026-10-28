/**
 * Verifies the published artifacts of the packages.
 *
 * The spec imports the built distributions (not the sources), so that a broken
 * build configuration is detected before a release. Run `pnpm run build` before
 * the test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CORE_DIST = join(ROOT, "packages", "core", "dist");
const SDK_DIST = join(ROOT, "packages", "sdk", "dist");

function readJson(file: string) {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

test("the core package publishes its distribution", () => {
  assert.ok(existsSync(join(CORE_DIST, "index.js")), "packages/core/dist/index.js is missing");
  assert.ok(
    existsSync(join(CORE_DIST, "index.d.ts")),
    "packages/core/dist/index.d.ts is missing",
  );

  const manifest = readJson(join(ROOT, "packages", "core", "package.json"));
  assert.equal(manifest.types, "./dist/index.d.ts");
  assert.ok(existsSync(join(ROOT, "packages", "core", manifest.types as string)));
});

test("the SDK package publishes its distribution", () => {
  assert.ok(existsSync(join(SDK_DIST, "index.js")), "packages/sdk/dist/index.js is missing");
  assert.ok(
    existsSync(join(SDK_DIST, "index.d.ts")),
    "packages/sdk/dist/index.d.ts is missing",
  );

  const manifest = readJson(join(ROOT, "packages", "sdk", "package.json"));
  assert.equal(manifest.types, "./dist/index.d.ts");
  assert.ok(existsSync(join(ROOT, "packages", "sdk", manifest.types as string)));
});

test("the built core exposes the public API", async () => {
  const core = await import("../packages/core/dist/index.js");
  for (const name of [
    "createEmptyDiagram",
    "exportSQL",
    "importSQL",
    "exportDBML",
    "parseDBML",
    "CommandManager",
    "MemoryStorageAdapter",
    "IndexedDBStorageAdapter",
    "MetadataRegistry",
    "PluginManager",
  ]) {
    assert.ok(name in core, `the core does not export ${name}`);
  }
});

test("the built SDK exposes the editor component", async () => {
  const sdk = await import("../packages/sdk/dist/index.js");
  assert.ok("DrawDBEditor" in sdk, "the SDK does not export DrawDBEditor");
  assert.ok("useDiagramStore" in sdk, "the SDK does not export useDiagramStore");
  assert.ok("useHistoryStore" in sdk, "the SDK does not export useHistoryStore");
});

test("the built SDK renders the editor", async () => {
  const { mount } = await import("@vue/test-utils");
  const { createPinia } = await import("pinia");
  const sdk = await import("../packages/sdk/dist/index.js");

  const editor = (sdk as Record<string, unknown>).DrawDBEditor as never;
  const wrapper = mount(editor as never, {
    props: { database: "mysql" },
    global: { plugins: [createPinia()] },
  });

  const html = wrapper.html();
  assert.ok(html.includes('data-testid="canvas"'), "the canvas is missing");
  assert.ok(html.includes('data-testid="outline-tree"'), "the outline tree is missing");
  assert.ok(html.includes('data-testid="edit-panel"'), "the edit panel is missing");
  assert.ok(html.includes('data-testid="bottom-panel"'), "the bottom panel is missing");

  wrapper.unmount();
});

test("the distribution contains the locales", () => {
  const locales = join(SDK_DIST, "i18n", "locales");
  assert.ok(existsSync(locales), "the locales are missing");
  assert.ok(statSync(locales).isDirectory());
  assert.ok(existsSync(join(locales, "en.json")), "the English locale is missing");
  assert.ok(existsSync(join(locales, "zh-CN.json")), "the Chinese locale is missing");
});
