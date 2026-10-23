import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { naive } from "../../../../scripts/naive-ui-mock.mjs";
import { exportPng, ImageExportError } from "./use-image-export.ts";
import { useFullscreen } from "./use-fullscreen.ts";
import ImageExportDialog from "../components/Dialogs/ImageExportDialog.vue";

/**
 * The capture of `html-to-image` is a browser API the sandbox cannot run, so
 * the tests replace it through `captureState.capture`, the small indirection
 * the composable captures through.
 */
async function withCapture<T>(
  replacement: () => Promise<string>,
  run: () => Promise<T>,
): Promise<T> {
  const { captureState } = await import("./use-image-export.ts");
  const original = captureState.capture;
  captureState.capture = replacement;
  try {
    return await run();
  } finally {
    captureState.capture = original;
  }
}

describe("image export", () => {
  it("exportPng adds the exporting marker while it runs", async () => {
    const element = document.createElement("div");
    const url = await withCapture(
      () =>
        new Promise<string>((resolve) => {
          assert.equal(element.getAttribute("data-exporting"), "true");
          resolve("data:image/png;base64,AAAA");
        }),
      () => exportPng(element),
    );
    assert.equal(url, "data:image/png;base64,AAAA");
  });

  it("exportPng removes the exporting marker afterwards", async () => {
    const element = document.createElement("div");
    await withCapture(
      () => Promise.resolve("data:image/png;base64,BBBB"),
      () => exportPng(element),
    );
    assert.equal(element.hasAttribute("data-exporting"), false);
  });

  it("exportPng restores the marker when it fails", async () => {
    const element = document.createElement("div");
    await assert.rejects(
      withCapture(
        () => Promise.reject(new Error("the capture broke")),
        () => exportPng(element),
      ),
    );
    assert.equal(element.hasAttribute("data-exporting"), false);
  });

  it("exportPng throws an ImageExportError when the capture fails", async () => {
    const element = document.createElement("div");
    await assert.rejects(
      withCapture(
        () => Promise.reject(new Error("boom")),
        () => exportPng(element),
      ),
      (error: unknown) => error instanceof ImageExportError,
    );
  });

  it("useFullscreen reports the current state", async () => {
    const element = document.createElement("div");
    const state = useFullscreen(ref(element));
    assert.equal(state.isFullscreen.value, false);
    await nextTick();
  });

  it("useFullscreen toggles the state", async () => {
    const element = document.createElement("div");
    const state = useFullscreen(ref(element));
    await state.toggle();
    assert.equal(state.isFullscreen.value, false);
  });
});

describe("ImageExportDialog", () => {
  it("the image export dialog offers the scale and the background colour", () => {
    setActivePinia(createPinia());
    const wrapper = mount(ImageExportDialog, {
      props: { open: true },
      global: { plugins: [naive] },
    });
    assert.ok(wrapper.find('[data-testid="image-export-scale"]').exists());
    assert.ok(wrapper.find('[data-testid="image-export-background"]').exists());
  });

  it("the image export dialog exports the canvas", async () => {
    setActivePinia(createPinia());
    const wrapper = mount(ImageExportDialog, {
      props: { open: true },
      attachTo: document.body,
      global: { plugins: [naive] },
    });
    await withCapture(
      () => Promise.resolve("data:image/png;base64,CCCC"),
      async () => {
        await wrapper.find('[data-testid="image-export-png"]').trigger("click");
        await nextTick();
      },
    );
    assert.ok(wrapper.find('[data-testid="image-export-done"]').exists());
  });
});
