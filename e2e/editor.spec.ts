import { expect, test } from "@playwright/test";
import {
  canvasLogicalTables,
  canvasTables,
  fillInput,
  sidePanelTables,
  waitForEditor,
} from "./helpers.ts";

/**
 * The tests of the editor of the SDK.
 *
 * They cover the work a user does with the side panel, the canvas and the menu
 * of the header.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(
  page: import("@playwright/test").Page,
  id: string,
): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

test.describe("the editor", () => {
  test("renames a table in the side panel", async ({ page }) => {
    await openEditor(page, "editor-rename");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);

    await page.getByTestId("table-item-table").click();
    await fillInput(page, "table-name-input", "customers");

    await expect(page.getByTestId("table-item-customers")).toBeVisible();
    await expect(page.getByTestId("table-item-table")).toHaveCount(0);
  });

  test("adds a field to the selected table", async ({ page }) => {
    await openEditor(page, "editor-field");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("table-item-table").click();

    await page.getByTestId("add-field-btn").click();

    await expect(page.getByTestId("field-list").locator("li")).toHaveCount(1);
  });

  test("removes a table from the side panel", async ({ page }) => {
    await openEditor(page, "editor-remove");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);

    await page.getByTestId("table-item-table").click();
    await page.getByTestId("remove-table-btn").click();

    await expect(canvasTables(page)).toHaveCount(0);
    await expect(sidePanelTables(page)).toHaveCount(0);
  });

  test("searches a table in the side panel", async ({ page }) => {
    await openEditor(page, "editor-search");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("add-table-btn").click();
    await expect(sidePanelTables(page)).toHaveCount(2);

    await fillInput(page, "side-panel-search", "table_1");

    await expect(sidePanelTables(page)).toHaveCount(1);
    await expect(page.getByTestId("table-item-table_1")).toBeVisible();
  });

  test("switches the tab of the side panel", async ({ page }) => {
    await openEditor(page, "editor-tabs");

    await page.getByTestId("relationships-tab").click();

    await expect(page.getByTestId("relationships-panel")).toBeVisible();
  });

  test("redoes the addition of a table", async ({ page }) => {
    await openEditor(page, "editor-redo");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);

    await page.getByTestId("undo-btn").click();
    await expect(canvasTables(page)).toHaveCount(0);

    await page.getByTestId("redo-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("switches between the physical and the logical view", async ({ page }) => {
    await openEditor(page, "editor-views");

    await page.getByTestId("add-table-btn").click();

    await page.getByTestId("menu-view").click();
    await page.getByText("Toggle view mode").click();

    await expect(canvasLogicalTables(page)).toHaveCount(1);
    await expect(canvasTables(page)).toHaveCount(0);
  });

  test("zooms the canvas in and out", async ({ page }) => {
    await openEditor(page, "editor-zoom");

    await page.getByTestId("zoom-in-btn").click();
    await page.getByTestId("zoom-out-btn").click();

    await expect(page.getByTestId("canvas")).toBeVisible();
  });

  test("opens the dialog of the SQL preview from the menu", async ({ page }) => {
    await openEditor(page, "editor-menu-sql");

    await page.getByTestId("add-table-btn").click();

    await page.getByTestId("menu-file").click();
    await page.getByText("Export SQL").click();

    await expect(page.getByTestId("sql-preview-dialog")).toBeVisible();
    await expect(page.getByTestId("sql-preview-content")).toContainText(
      "CREATE TABLE",
    );
  });

  test("opens the dialog of the DBML preview from the menu", async ({
    page,
  }) => {
    await openEditor(page, "editor-menu-dbml");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("table-item-table").click();
    await page.getByTestId("add-field-btn").click();

    await page.getByTestId("menu-file").click();
    await page.getByText("Export DBML").click();

    await expect(page.getByTestId("sql-preview-dialog")).toBeVisible();
    await expect(page.getByTestId("sql-preview-content")).toContainText("Table");
  });

  test("opens the dialog of the import from the menu", async ({ page }) => {
    await openEditor(page, "editor-menu-import");

    await page.getByTestId("menu-file").click();
    await page.getByText("Import JSON").click();

    await expect(page.getByTestId("import-dialog")).toBeVisible();
    await expect(page.getByTestId("import-format")).toHaveText("json");
  });

  test("opens the dialog of the image export from the menu", async ({
    page,
  }) => {
    await openEditor(page, "editor-menu-png");

    await page.getByTestId("add-table-btn").click();

    await page.getByTestId("menu-file").click();
    await page.getByText("Export PNG").click();

    await expect(page.getByTestId("image-export-dialog")).toBeVisible();
  });

  test("opens the dialog of the automatic relationships from the menu", async ({
    page,
  }) => {
    await openEditor(page, "editor-menu-relations");

    await page.getByTestId("menu-edit").click();
    await page.getByText("Auto create relationships").click();

    await expect(page.getByTestId("auto-relationships-dialog")).toBeVisible();
  });

  test("hides the side panel from the menu", async ({ page }) => {
    await openEditor(page, "editor-menu-sidebar");

    await expect(page.getByTestId("side-panel")).toBeVisible();

    await page.getByTestId("menu-view").click();
    await page.getByText("Toggle side panel").click();

    await expect(page.getByTestId("side-panel")).toBeHidden();
  });

  test("changes the database of the diagram", async ({ page }) => {
    await openEditor(page, "editor-database");

    await page.getByTestId("database-select").click();
    await page.getByText("PostgreSQL", { exact: true }).click();

    const database = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          __DRAWDB__?: { getDiagram: () => { database?: string } };
        }
      ).__DRAWDB__;
      return bridge?.getDiagram().database;
    });

    expect(database).toBe("postgres");
  });
});
