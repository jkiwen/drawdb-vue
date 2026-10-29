import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TABLE_COLOR,
  TABLE_COLOR_PRESETS,
  isPresetColor,
  presetColor,
} from "./color-palette.ts";

const HEX = /^#[0-9a-f]{6}$/;

describe("the presets of the table colour", () => {
  it("offers ten colours", () => {
    assert.equal(TABLE_COLOR_PRESETS.length, 10);
  });

  it("names every colour once, in a hex the canvas can paint", () => {
    const tokens = TABLE_COLOR_PRESETS.map((preset) => preset.token);
    const values = TABLE_COLOR_PRESETS.map((preset) => preset.value);
    assert.equal(new Set(tokens).size, tokens.length);
    assert.equal(new Set(values).size, values.length);
    for (const value of values) {
      assert.match(value, HEX);
    }
  });

  it("keeps the default outside the presets, so a reader can go back to it", () => {
    assert.match(DEFAULT_TABLE_COLOR, HEX);
    assert.ok(!TABLE_COLOR_PRESETS.some((preset) => preset.value === DEFAULT_TABLE_COLOR));
  });

  it("recognises a preset whatever the case of the hex", () => {
    assert.equal(isPresetColor(TABLE_COLOR_PRESETS[0]!.value.toUpperCase()), true);
    assert.equal(isPresetColor("#123456"), false);
    assert.equal(isPresetColor(undefined), false);
    assert.equal(isPresetColor(""), false);
  });

  it("reads a preset by its token", () => {
    assert.equal(presetColor("slate"), TABLE_COLOR_PRESETS[0]!.value);
    assert.equal(presetColor("unknown"), undefined);
  });
});
