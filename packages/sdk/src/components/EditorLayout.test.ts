import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import EditorLayout from "./EditorLayout.vue";
import Header from "./Header/Header.vue";
import ResizablePanel from "./Layout/ResizablePanel.vue";
import {
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from "../stores/settings.ts";
import { naive } from "../../../../scripts/naive-ui-mock.mjs";

/**
 * Stubs the media query of the browser.
 *
 * jsdom does not implement `matchMedia`, so the small viewport behaviour of
 * the layout is driven through this stub. The stub is removed again after
 * every test, because the runner shares one process between the specs.
 */
function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
}

function dropMatchMedia(): void {
  delete (window as unknown as Record<string, unknown>).matchMedia;
}

describe("EditorLayout", () => {
  let pinia: Pinia;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    dropMatchMedia();
    // The specs share one process, so a persisted preference would leak.
    localStorage.clear();
  });

  function mountLayout(props: Record<string, unknown> = {}) {
    return mount(EditorLayout, {
      props,
      global: { plugins: [pinia, naive] },
    });
  }

  function panel(wrapper: ReturnType<typeof mountLayout>, side: string) {
    const found = wrapper
      .findAllComponents(ResizablePanel)
      .find((candidate) => candidate.props("side") === side);
    assert.ok(found, `the ${side} panel was not rendered`);
    return found;
  }

  it("renders the header, the outline, the canvas and the placeholders", () => {
    const wrapper = mountLayout();
    assert.ok(wrapper.find('[data-testid="header"]').exists());
    assert.ok(wrapper.find('[data-testid="outline-tree"]').exists());
    assert.ok(wrapper.find('[data-testid="canvas"]').exists());
    assert.ok(wrapper.find('[data-testid="edit-panel"]').exists());
    assert.ok(wrapper.find('[data-testid="bottom-panel"]').exists());
  });

  it("hides the left panel when the side panel is not shown", () => {
    const wrapper = mountLayout({ showSidePanel: false });
    assert.ok(!wrapper.find('[data-testid="outline-tree"]').exists());
    const left = wrapper
      .findAllComponents(ResizablePanel)
      .filter((candidate) => candidate.props("side") === "left");
    assert.equal(left.length, 0);
    assert.ok(wrapper.find('[data-testid="edit-panel"]').exists());
  });

  it("persists the collapsed state of a panel", async () => {
    const wrapper = mountLayout();
    const toggle = panel(wrapper, "left").find(
      '[data-testid="panel-collapse-toggle"]',
    );
    await toggle.trigger("click");
    assert.equal(useSettingsStore().settings.panelLeftCollapsed, true);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    assert.equal(stored.panelLeftCollapsed, true);
  });

  it("persists the width of a panel", () => {
    const wrapper = mountLayout();
    panel(wrapper, "right").vm.$emit("update:width", 360);
    assert.equal(useSettingsStore().settings.panelRightWidth, 360);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    assert.equal(stored.panelRightWidth, 360);
  });

  it("uses the persisted width of a panel", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ panelLeftWidth: 250 }),
    );
    const wrapper = mountLayout();
    assert.equal(panel(wrapper, "left").props("width"), 250);
  });

  it("collapses the panels on a small viewport without a preference", () => {
    stubMatchMedia(true);
    const wrapper = mountLayout();
    assert.equal(panel(wrapper, "left").props("collapsed"), true);
    assert.equal(panel(wrapper, "right").props("collapsed"), true);
  });

  it("keeps the panels open on a large viewport without a preference", () => {
    stubMatchMedia(false);
    const wrapper = mountLayout();
    assert.equal(panel(wrapper, "left").props("collapsed"), false);
    assert.equal(panel(wrapper, "right").props("collapsed"), false);
  });

  it("prefers a persisted preference over the small viewport default", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ panelLeftCollapsed: false }),
    );
    stubMatchMedia(true);
    const wrapper = mountLayout();
    assert.equal(panel(wrapper, "left").props("collapsed"), false);
    assert.equal(panel(wrapper, "right").props("collapsed"), true);
  });

  it("keeps the menu and the save events of the header", async () => {
    const wrapper = mountLayout();
    const header = wrapper.findComponent(Header);
    assert.ok(header.exists());
    // The header emits through the layout; the interface is unchanged.
    await header.vm.$emit("menu", "open");
    assert.deepEqual(wrapper.emitted("menu"), [["open"]]);
    await header.vm.$emit("save");
    assert.ok(wrapper.emitted("save"));
  });

  it("hides the chrome parts the host turns off (Q13)", () => {
    const wrapper = mountLayout({
      chrome: { outline: false, editPanel: false, bottomPanel: false, toolbar: false },
    });
    assert.ok(!wrapper.find('[data-testid="outline-tree"]').exists());
    assert.ok(!wrapper.find('[data-testid="edit-panel"]').exists());
    assert.ok(!wrapper.find('[data-testid="bottom-panel"]').exists());
    assert.ok(!wrapper.find('[data-testid="canvas-toolbar"]').exists());
    assert.ok(wrapper.find('[data-testid="canvas"]').exists());
    assert.ok(wrapper.find('[data-testid="header"]').exists());
  });

  it("keeps only the toolbar groups the host picks", () => {
    const wrapper = mountLayout({
      chrome: { toolbar: { groups: ["zoom"] } },
    });
    const toolbar = wrapper.find('[data-testid="canvas-toolbar"]');
    assert.ok(toolbar.exists());
    assert.ok(toolbar.find('[data-testid="toolbar-zoom"]').exists());
    assert.ok(!toolbar.find('[data-testid="toolbar-display-mode"]').exists());
    assert.ok(!toolbar.find('[data-testid="toolbar-file"]').exists());
  });
});
