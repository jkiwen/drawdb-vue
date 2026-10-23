import { expect, test } from "@playwright/test";

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
    await expect(page.getByTestId("side-panel")).toBeVisible();
  });

  test("adds a table in the editor", async ({ page }) => {
    await page.goto("/editor/smoke-2");

    await page.getByTestId("add-table-btn").click();

    const tables = page.locator('[data-testid="canvas"] [data-testid^="table-"]');
    await expect(tables).toHaveCount(1);
  });

  test("undoes the addition of a table", async ({ page }) => {
    await page.goto("/editor/smoke-3");

    await page.getByTestId("add-table-btn").click();
    const tables = page.locator('[data-testid="canvas"] [data-testid^="table-"]');
    await expect(tables).toHaveCount(1);

    await page.getByTestId("undo-btn").click();
    await expect(tables).toHaveCount(0);
  });

  test("keeps the diagram when the page is reloaded", async ({ page }) => {
    await page.goto("/editor/smoke-4");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("save-btn").click();
    await expect(page.getByTestId("save-state")).toBeVisible();

    await page.reload();

    const tables = page.locator('[data-testid="canvas"] [data-testid^="table-"]');
    await expect(tables).toHaveCount(1);
  });

  test("switches between the physical and the logical view", async ({ page }) => {
    await page.goto("/editor/smoke-5");

    await page.getByTestId("add-table-btn").click();
    await expect(
      page.locator('[data-testid="canvas"] [data-testid^="table-"]'),
    ).toHaveCount(1);

    await page.getByTestId("menu-view").click();
    await page.getByText("Toggle view mode").click();

    await expect(
      page.locator('[data-testid="canvas"] [data-testid^="logical-table-"]'),
    ).toHaveCount(1);
  });
});
