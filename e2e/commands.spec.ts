import { expect, test } from "@playwright/test";
import { canvasTables, waitForEditor } from "./helpers.ts";

/**
 * The tests of the commands of the plugins.
 *
 * A host application extends the editor with plugins. Every plugin can
 * register commands, which the host runs through the editor of the SDK.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(
  page: import("@playwright/test").Page,
  id: string,
): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** Runs a command of a plugin and reports whether it was found. */
async function runCommand(
  page: import("@playwright/test").Page,
  key: string,
): Promise<boolean> {
  return page.evaluate((command) => {
    const found = (
      window as unknown as { __DRAWDB__?: { runCommand(key: string): boolean } }
    ).__DRAWDB__;
    return found?.runCommand(command) ?? false;
  }, key);
}

/** The notes of the diagram the editor shows. */
async function noteCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const found = (
      window as unknown as {
        __DRAWDB__?: { getDiagram(): { notes?: unknown[] } };
      }
    ).__DRAWDB__;
    return found?.getDiagram().notes?.length ?? 0;
  });
}

test.describe("the commands of the plugins", () => {
  test("runs a command of a plugin", async ({ page }) => {
    await openEditor(page, "commands-1");

    expect(await noteCount(page)).toBe(0);

    const ran = await runCommand(page, "demo.add-note");

    expect(ran).toBe(true);
    await expect.poll(() => noteCount(page)).toBe(1);
  });

  test("reports the command that it does not know", async ({ page }) => {
    await openEditor(page, "commands-2");

    const ran = await runCommand(page, "demo.does-not-exist");

    expect(ran).toBe(false);
  });

  test("validates the diagram of the editor", async ({ page }) => {
    await openEditor(page, "commands-3");

    const issues = await page.evaluate(() => {
      const found = (
        window as unknown as { __DRAWDB__?: { validate(): unknown[] } }
      ).__DRAWDB__;
      return found?.validate() ?? [];
    });

    expect(Array.isArray(issues)).toBe(true);
  });

  test("arranges the tables of the diagram", async ({ page }) => {
    await openEditor(page, "commands-4");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(2);

    await page.evaluate(() => {
      const found = (
        window as unknown as { __DRAWDB__?: { autoArrange(): void } }
      ).__DRAWDB__;
      found?.autoArrange();
    });

    await expect(canvasTables(page)).toHaveCount(2);
  });

  test("adds a note with the command of the plugin", async ({ page }) => {
    await openEditor(page, "commands-5");

    await runCommand(page, "demo.add-note");

    await expect.poll(() => noteCount(page)).toBe(1);
  });
});
