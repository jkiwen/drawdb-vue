import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import ResizablePanel from "./ResizablePanel.vue";

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ResizablePanel, {
    props: {
      side: "left",
      width: 280,
      minWidth: 240,
      maxWidth: 320,
      defaultWidth: 280,
      collapsed: false,
      ...props,
    },
    slots: { default: "<div data-testid='panel-inner'>content</div>" },
  });
}

function dragResizer(
  wrapper: ReturnType<typeof mountPanel>,
  fromClientX: number,
  toClientX: number,
): void {
  wrapper
    .find('[data-testid="panel-resizer"]')
    .trigger("mousedown", { clientX: fromClientX });
  document.dispatchEvent(new MouseEvent("mousemove", { clientX: toClientX }));
  document.dispatchEvent(new MouseEvent("mouseup"));
}

describe("ResizablePanel", () => {
  it("renders the slot with the width it is given", () => {
    const wrapper = mountPanel({ width: 280 });
    const panel = wrapper.find('[data-testid="resizable-panel"]');
    assert.ok(panel.exists());
    assert.ok(panel.attributes("style")?.includes("width: 280px"));
    assert.ok(wrapper.find('[data-testid="panel-inner"]').exists());
  });

  it("widens a left panel when the resizer is dragged to the right", () => {
    const wrapper = mountPanel({ side: "left", width: 280 });
    dragResizer(wrapper, 280, 320);
    const events = wrapper.emitted("update:width");
    assert.ok(events && events.length > 0);
    assert.equal(events[events.length - 1][0], 320);
  });

  it("widens a right panel when the resizer is dragged to the left", () => {
    const wrapper = mountPanel({
      side: "right",
      width: 320,
      minWidth: 280,
      maxWidth: 400,
      defaultWidth: 320,
    });
    dragResizer(wrapper, 320, 300);
    const events = wrapper.emitted("update:width");
    assert.ok(events && events.length > 0);
    assert.equal(events[events.length - 1][0], 340);
  });

  it("clamps the width of a drag to the minimum and the maximum", () => {
    const wrapper = mountPanel({ side: "left", width: 280 });
    dragResizer(wrapper, 280, 200);
    let events = wrapper.emitted("update:width")!;
    assert.equal(events[events.length - 1][0], 240);
    dragResizer(wrapper, 280, 900);
    events = wrapper.emitted("update:width")!;
    assert.equal(events[events.length - 1][0], 320);
  });

  it("restores the default width when the resizer is double clicked", async () => {
    const wrapper = mountPanel({ width: 300, defaultWidth: 280 });
    await wrapper.find('[data-testid="panel-resizer"]').trigger("dblclick");
    const events = wrapper.emitted("update:width");
    assert.ok(events && events.length > 0);
    assert.equal(events[events.length - 1][0], 280);
  });

  it("toggles the collapsed state when the chevron handle is clicked", async () => {
    const wrapper = mountPanel({ collapsed: false });
    await wrapper.find('[data-testid="panel-collapse-toggle"]').trigger("click");
    assert.deepEqual(wrapper.emitted("update:collapsed"), [[true]]);
  });

  it("expands when the chevron handle of a collapsed panel is clicked", async () => {
    const wrapper = mountPanel({ collapsed: true });
    await wrapper.find('[data-testid="panel-collapse-toggle"]').trigger("click");
    assert.deepEqual(wrapper.emitted("update:collapsed"), [[false]]);
  });

  it("collapses to a zero width and hides the resizer", () => {
    const wrapper = mountPanel({ collapsed: true });
    const panel = wrapper.find('[data-testid="resizable-panel"]');
    assert.ok(panel.attributes("style")?.includes("width: 0px"));
    assert.ok(!wrapper.find('[data-testid="panel-resizer"]').exists());
  });

  it("stops resizing when the mouse button is released", async () => {
    const wrapper = mountPanel({ side: "left", width: 280 });
    await wrapper
      .find('[data-testid="panel-resizer"]')
      .trigger("mousedown", { clientX: 280 });
    document.dispatchEvent(new MouseEvent("mouseup"));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 320 }));
    assert.ok(!wrapper.emitted("update:width"));
  });
});
