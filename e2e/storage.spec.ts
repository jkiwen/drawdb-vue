import { expect, test } from "@playwright/test";
import { canvasTables, waitForEditor } from "./helpers.ts";

/**
 * The tests of the persistence of the standalone application.
 *
 * The application stores its diagrams in IndexedDB, so that a diagram survives
 * a reload of the page and shows up in the list of the home page.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(
  page: import("@playwright/test").Page,
  id: string,
): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** Reads the rows of the store of the diagrams of the browser. */
async function storedIds(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const open = indexedDB.open("drawdb");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const store = database.transaction("diagrams", "readonly").objectStore("diagrams");
    const rows = await new Promise<{ id: string }[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as { id: string }[]);
      request.onerror = () => reject(request.error);
    });
    return rows.map((row) => row.id);
  });
}

test.describe("the persistence", () => {
  test("stores a diagram in the browser", async ({ page }) => {
    await openEditor(page, "storage-1");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await expect.poll(() => storedIds(page)).toContain("storage-1");
  });

  test("keeps a diagram when the page is reloaded", async ({ page }) => {
    await openEditor(page, "storage-2");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await page.reload();

    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("lists a diagram on the home page", async ({ page }) => {
    await openEditor(page, "storage-3");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await page.goto("/");

    await expect(page.getByTestId("diagram-list")).toBeVisible();
    await expect(page.getByTestId("diagram-link")).toHaveCount(1);
  });

  test("opens a diagram of the home page in the editor", async ({ page }) => {
    await openEditor(page, "storage-4");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await page.goto("/");
    await page.getByTestId("diagram-link").click();

    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("removes a diagram from the home page", async ({ page }) => {
    await openEditor(page, "storage-5");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await page.goto("/");
    await expect(page.getByTestId("diagram-link")).toHaveCount(1);

    await page.getByTestId("remove-diagram").click();

    await expect(page.getByTestId("home-empty")).toBeVisible();
  });

  test("opens a template in the editor", async ({ page }) => {
    await page.goto("/templates");

    await page.getByTestId("template-link").first().click();
    await expect(page.getByTestId("template-name")).toBeVisible();
    await expect(page.getByTestId("template-tables").locator("li")).toHaveCount(3);

    await page.getByTestId("use-template").click();

    await expect(canvasTables(page)).toHaveCount(3);
  });
});
