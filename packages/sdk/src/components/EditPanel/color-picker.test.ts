import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";

import ColorPicker from "./ColorPicker.vue";
import { TABLE_COLOR_PRESETS } from "../../utils/color-palette.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** The picker reads its label from the catalogue; the mock keeps the key. */
function catalogue(): Record<string, string> {
  return JSON.parse(
    readFileSync(resolve(here, "../../i18n/locales/en.json"), "utf8"),
  ) as Record<string, string>;
}

function mountPicker(props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(ColorPicker, {
    props: { value: "", testid: "picker", ...props },
    global: { plugins: [pinia] },
  });
}

describe("ColorPicker", () => {
  let keys: Record<string, string>;
  beforeEach(() => {
    keys = catalogue();
  });

  it("offers every preset and one custom colour", () => {
    const wrapper = mountPicker();
    for (const preset of TABLE_COLOR_PRESETS) {
      assert.equal(
        wrapper.find(`[data-testid="picker-preset-${preset.token}"]`).exists(),
        true,
        preset.token,
      );
    }
    assert.equal(wrapper.find('[data-testid="picker-custom"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="picker-clear"]').exists(), true);
  });

  it("marks the colour that is set, and the default when there is none", () => {
    const preset = TABLE_COLOR_PRESETS[3]!;
    const chosen = mountPicker({ value: preset.value.toUpperCase() });
    assert.equal(
      chosen.find(`[data-testid="picker-preset-${preset.token}"]`).attributes("aria-pressed"),
      "true",
    );

    const empty = mountPicker({ value: "" });
    assert.equal(empty.find('[data-testid="picker-clear"]').attributes("aria-pressed"), "true");
  });

  it("emits the colour of the preset that is clicked", async () => {
    const wrapper = mountPicker();
    await wrapper.find('[data-testid="picker-preset-teal"]').trigger("click");
    assert.deepEqual(wrapper.emitted("update:value")?.[0], ["#0d9488"]);
  });

  it("emits an empty value when the default is asked for", async () => {
    const wrapper = mountPicker({ value: "#0d9488" });
    await wrapper.find('[data-testid="picker-clear"]').trigger("click");
    assert.deepEqual(wrapper.emitted("update:value")?.[0], [""]);
  });

  it("emits the colour typed into the custom well", async () => {
    const wrapper = mountPicker();
    const custom = wrapper.find('[data-testid="picker-custom"]');
    await custom.setValue("#123456");
    assert.deepEqual(wrapper.emitted("update:value")?.at(-1), ["#123456"]);
  });

  it("shows no colour as chosen when the selection disagrees", () => {
    const wrapper = mountPicker({ value: "", multiple: true });
    assert.equal(
      wrapper.findAll('[aria-pressed="true"]').length,
      0,
      "a mixed selection marks nothing",
    );
  });

  it("refuses to change a locked table", async () => {
    const wrapper = mountPicker({ disabled: true });
    await wrapper.find('[data-testid="picker-preset-teal"]').trigger("click");
    assert.equal(wrapper.emitted("update:value"), undefined);
  });

  it("keeps the catalogue and the picker in step", () => {
    assert.equal(typeof keys.edit_panel_color_default, "string");
  });
});
