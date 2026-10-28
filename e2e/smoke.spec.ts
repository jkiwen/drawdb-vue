import { expect, test } from "@playwright/test";
import { canvasTables } from "./helpers.ts";

/**
 * The smoke tests of the standalone application.
 *
 * They cover the path that every user walks through: the list of the
 * diagrams, the editor, the addition of a table and the persistence.
 */
test.describe("smoke", () => {
  test("opens the home page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("home-view")).toBeVisible();
    await expect(page.getByTestId("brand")).toHaveText("drawDB");
  });

  test("shows the templates", async ({ page }) => {
    await page.goto("/templates");

    await expect(page.getByTestId("template-link").first()).toBeVisible();
  });

  test("opens the editor of a diagram", async ({ page }) => {
    await page.goto("/editor/smoke-1");

    await expect(page.getByTestId("editor-view")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await expect(page.getByTestId("outline-tree")).toBeVisible();
  });

  test("adds a table in the editor", async ({ page }) => {
    await page.goto("/editor/smoke-2");

    await page.getByTestId("add-table-btn").click();

    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("undoes the addition of a table", async ({ page }) => {
    await page.goto("/editor/smoke-3");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);

    await page.getByTestId("undo-btn").click();
    await expect(canvasTables(page)).toHaveCount(0);
  });

  test("keeps the diagram when the page is reloaded", async ({ page }) => {
    await page.goto("/editor/smoke-4");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toHaveText("Saved");

    await page.reload();

    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("switches between the physical and the logical view", async ({ page }) => {
    await page.goto("/editor/smoke-5");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);

    // The physical layer also lists the physical-only categories; the logical
    // layer hides them.
    await expect(page.getByTestId("outline-row-cat:views")).toBeVisible();

    const layer = page.getByTestId("toolbar-view-layer");
    await layer.click();

    await expect(layer).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("outline-row-cat:views")).toHaveCount(0);
    // The canvas draws the table uniformly in both layers.
    await expect(canvasTables(page)).toHaveCount(1);

    await layer.click();

    await expect(layer).not.toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("outline-row-cat:views")).toBeVisible();
    await expect(canvasTables(page)).toHaveCount(1);
  });
});
