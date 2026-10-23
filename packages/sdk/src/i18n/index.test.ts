import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  LANGUAGES,
  availableLocales,
  createI18n,
  localeMessages,
  setLocale,
  t,
} from "./index.ts";

describe("the translations of the SDK", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("loads the english translations", async () => {
    const i18n = await createI18n("en");
    assert.equal(i18n.global.t("table"), "Table");
  });

  it("loads the chinese translations", async () => {
    const i18n = await createI18n("zh-CN");
    assert.equal(i18n.global.t("save"), "保存");
    assert.equal(i18n.global.t("table"), "表");
  });

  it("falls back to english for an unknown locale", async () => {
    const i18n = await createI18n("xx-YY");
    assert.equal(i18n.global.locale.value, "en");
    assert.equal(i18n.global.t("table"), "Table");
  });

  it("resolves a locale with a region", async () => {
    const i18n = await createI18n("en-US");
    assert.equal(i18n.global.locale.value, "en");
  });

  it("resolves the chinese locale of the browser", async () => {
    const i18n = await createI18n("zh");
    assert.equal(i18n.global.locale.value, "zh-CN");
  });

  it("offers every locale of the application", () => {
    assert.ok(availableLocales.includes("en"));
    assert.ok(availableLocales.includes("zh-CN"));
    assert.ok(availableLocales.length >= 36);
  });

  it("names the languages", () => {
    const english = LANGUAGES.find((language) => language.code === "en");
    assert.ok(english);
    assert.equal(english.name, "English");
    assert.equal(english.nativeName, "English");
  });

  it("gives every locale the same keys as english", () => {
    const keys = Object.keys(localeMessages.en).sort();
    for (const locale of availableLocales) {
      assert.deepEqual(
        Object.keys(localeMessages[locale]).sort(),
        keys,
        `the locale ${locale} does not have the same keys as english`,
      );
    }
  });

  it("translates with the shared instance", () => {
    assert.equal(t("table"), "Table");
    setLocale("zh-CN");
    assert.equal(t("save"), "保存");
  });
});
