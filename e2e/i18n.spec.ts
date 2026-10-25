import { expect, test } from "@playwright/test";
import { waitForEditor } from "./helpers.ts";

/**
 * The tests of the language of the editor.
 *
 * The SDK ships the translations of 51 languages. The application can pick the
 * language of the editor with the `locale` property.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(
  page: import("@playwright/test").Page,
  id: string,
): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** The languages the SDK ships the translations of. */
const LANGUAGES = [
  "ar",
  "as",
  "bg",
  "bn",
  "cz",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fa",
  "fi",
  "fr",
  "gu",
  "he",
  "hi",
  "hu",
  "hy",
  "id",
  "it",
  "jp",
  "ka",
  "ko",
  "ml",
  "mn",
  "mr",
  "ms",
  "ne",
  "nl",
  "no",
  "od",
  "pa-PK",
  "pa",
  "pl",
  "pt-BR",
  "ro",
  "ru",
  "sd",
  "sv",
  "sw",
  "te",
  "th",
  "tl",
  "tm",
  "tr",
  "ug",
  "uk",
  "ur",
  "vi",
  "zh-CN",
  "zh-TW",
];

test.describe("the language of the editor", () => {
  test("shows the editor in the language of the application", async ({
    page,
  }) => {
    await openEditor(page, "i18n-1");

    await expect(page.getByTestId("header")).toBeVisible();
    await expect(page.getByTestId("save-btn")).toBeVisible();
  });

  test("ships the translations of every language", async ({ page }) => {
    await openEditor(page, "i18n-2");

    const missing = await page.evaluate(async (codes) => {
      const requests = codes.map(async (code) => {
        const response = await fetch(`/src/i18n/locales/${code}.json`);
        return response.ok ? undefined : code;
      });
      const results = await Promise.all(requests);
      return results.filter((code): code is string => code !== undefined);
    }, LANGUAGES);

    expect(missing).toEqual([]);
  });
});
