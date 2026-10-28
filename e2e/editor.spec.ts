import { expect, test, type Page } from "@playwright/test";
import {
  canvasTables,
  outlineRow,
  outlineTables,
  waitForEditor,
} from "./helpers.ts";

/**
 * The tests of the editor of the SDK.
 *
 * They cover the work a user does with the outline tree, the edit panel, the
 * canvas and the menu of the header.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(page: Page, id: string): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** The id of the only table of the canvas, read from its test id. */
async function tableId(page: Page): Promise<string> {
  const testId = await canvasTables(page).first().getAttribute("data-testid");
  expect(testId).toMatch(/^table-.+/);
  return (testId ?? "").slice("table-".length);
}

/** Renames a node of the outline tree through its context menu. */
async function renameInOutline(
  page: Page,
  nodeId: string,
  name: string,
): Promise<void> {
  await outlineRow(page, nodeId).click({ button: "right" });
  await page.getByTestId("outline-menu-rename").click();
  const input = page.getByTestId("outline-rename-input");
  await input.fill(name);
  await input.press("Enter");
}

test.describe("the editor", () => {
  test("renames a table in the outline", async ({ page }) => {
    await openEditor(page, "editor-rename");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);
    const id = await tableId(page);

    await renameInOutline(page, `table:${id}`, "customers");

    await expect(outlineRow(page, `table:${id}`)).toContainText("customers");
    await expect(outlineTables(page)).toHaveCount(1);
    await expect(page.getByTestId(`table-name-${id}`)).toHaveText("customers");
  });

  test("adds a field to the selected table", async ({ page }) => {
    await openEditor(page, "editor-field");

    await page.getByTestId("add-table-btn").click();
    const id = await tableId(page);
    await outlineRow(page, `table:${id}`).click();

    const editPanel = page.getByTestId("edit-panel");
    await expect(editPanel.getByTestId("table-editor")).toBeVisible();
    await editPanel.getByTestId("add-field").click();

    await expect(editPanel.getByTestId("field-row")).toHaveCount(1);
    await expect(
      page.locator(
        `[data-testid="canvas"] [data-testid="table-${id}"] .ddb-table__row`,
      ),
    ).toHaveCount(1);
  });

  test("removes a table from the outline", async ({ page }) => {
    await openEditor(page, "editor-remove");

    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(1);
    const id = await tableId(page);

    await outlineRow(page, `table:${id}`).click({ button: "right" });
    await page.getByTestId("outline-menu-delete").click();

    await expect(canvasTables(page)).toHaveCount(0);
    await expect(outlineTables(page)).toHaveCount(0);
    await expect(page.getByTestId("outline-empty")).toBeVisible();
  });

  test("searches a table in the outline", async ({ page }) => {
    await openEditor(page, "editor-search");

    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("add-table-btn").click();
    await expect(outlineTables(page)).toHaveCount(2);

    const filter = page.getByTestId("outline-filter");
    await filter.fill("table_1");

    await expect(outlineTables(page)).toHaveCount(1);
    await expect(outlineTables(page).first()).toContainText("table_1");

    await filter.fill("");
    await expect(outlineTables(page)).toHaveCount(2);
  });

  test("switches the tab of the bottom panel", async ({ page }) => {
    await openEditor(page, "editor-tabs");

    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("history-tab")).toBeVisible();

    await page.getByTestId("tab-issues").click();
    await expect(page.getByTestId("alerts-tab")).toBeVisible();
    await expect(page.getByTestId("history-tab")).toHaveCount(0);
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
    const id = await tableId(page);

    await outlineRow(page, `table:${id}`).click();
    const physicalName = page.getByTestId("table-physical-name");
    await physicalName.fill("customers");
    await physicalName.blur();

    const layer = page.getByTestId("toolbar-view-layer");
    await expect(page.getByTestId(`table-name-${id}`)).toHaveText("customers");
    await expect(layer).not.toHaveAttribute("aria-pressed", "true");

    await layer.click();

    // The logical layer names the table by its logical entity name, which the
    // physical rename left untouched, and the outline follows the layer.
    await expect(layer).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`table-name-${id}`)).toHaveText("table");
    await expect(outlineRow(page, `table:${id}`)).toContainText("table");

    await layer.click();

    await expect(layer).not.toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`table-name-${id}`)).toHaveText("customers");
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
    const id = await tableId(page);
    await outlineRow(page, `table:${id}`).click();
    await page.getByTestId("edit-panel").getByTestId("add-field").click();

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

  test("hides the outline from the menu", async ({ page }) => {
    await openEditor(page, "editor-menu-sidebar");

    await expect(page.getByTestId("outline-tree")).toBeVisible();

    await page.getByTestId("menu-view").click();
    await page.getByText("Toggle side panel").click();

    await expect(page.getByTestId("outline-tree")).toBeHidden();
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
