import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { canvasTables, waitForEditor } from "./helpers.ts";

/**
 * The end to end tests of the key paths of the P5 ui redesign.
 *
 * They cover the four paths a user walks through with the new shell: the
 * outline tree locates a table on the canvas, the edit panel edits the
 * paired logical and physical fields, the display modes of the canvas
 * toolbar change the rows of the canvas, and an alert of the bottom panel
 * locates the table it is about.
 *
 * The positions of the tables are read through the test bridge of the
 * application, so the assertions do not hardcode the layout arithmetic of
 * the header.
 */

interface BridgeTable {
  id: string | number;
  name: string;
  x: number;
  y: number;
}

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(page: Page, id: string): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** The tables of the diagram of the editor, read through the test bridge. */
async function bridgeTables(page: Page): Promise<BridgeTable[]> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        __DRAWDB__?: { getDiagram: () => { tables: BridgeTable[] } };
      }
    ).__DRAWDB__;
    return bridge?.getDiagram().tables ?? [];
  });
}

/** The canvas group of a table. */
function canvasTable(page: Page, id: string | number) {
  return page.getByTestId(`table-${id}`);
}

/**
 * The transform of the content of the canvas after it scrolled to (x, y)
 * with the initial zoom (use-canvas-items builds
 * `translate(-scrollX * zoom -scrollY * zoom) scale(zoom)`).
 */
function focusTransform(x: number, y: number): string {
  return `translate(${-x} ${-y}) scale(1)`;
}

test.describe("the shell of the P5 redesign", () => {
  test("the outline tree selects a table and scrolls the canvas to it", async ({
    page,
  }) => {
    await openEditor(page, "p5-outline-focus");
    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("add-table-btn").click();
    await expect(canvasTables(page)).toHaveCount(2);

    // The second table is selected after its creation; clicking the row of
    // the first table has to move the selection and the canvas.
    const [first] = await bridgeTables(page);
    await page.getByTestId(`outline-row-table:${first.id}`).click();

    await expect(canvasTable(page, first.id)).toHaveClass(/is-selected/);
    await expect(page.getByTestId("canvas-content")).toHaveAttribute(
      "transform",
      focusTransform(first.x, first.y),
    );
  });

  test("the edit panel edits the paired fields and the canvas follows", async ({
    page,
  }) => {
    await openEditor(page, "p5-edit-panel-field");
    await page.getByTestId("add-table-btn").click();
    const [table] = await bridgeTables(page);

    // Select the table on the canvas, like a user would.
    await canvasTable(page, table.id).click();

    const panel = page.getByTestId("edit-panel");
    await expect(panel.getByTestId("table-editor")).toBeVisible();
    await panel.getByTestId("add-field").click();

    // One row per field pair: the logical name next to the physical name.
    const rows = panel.getByTestId("field-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.getByTestId("logical-name-input")).toHaveCount(1);
    await expect(rows.getByTestId("physical-name-input")).toHaveCount(1);
    await expect(panel.getByTestId("field-overview")).toContainText("1 paired");

    const input = rows.getByTestId("physical-name-input");
    await input.fill("order_id");
    // The plain inputs of the panel commit on change, like the Naive UI ones.
    await input.blur();

    await expect(canvasTable(page, table.id)).toContainText("order_id");
  });

  test("the display modes of the toolbar change the rows of the canvas", async ({
    page,
  }) => {
    await openEditor(page, "p5-display-modes");
    await page.getByTestId("add-table-btn").click();
    const [table] = await bridgeTables(page);

    const panel = page.getByTestId("edit-panel");
    await panel.getByTestId("add-field").click();
    await panel.getByTestId("add-field").click();
    await expect(panel.getByTestId("field-row")).toHaveCount(2);

    const rows = canvasTable(page, table.id).locator(".ddb-table__row");
    // The editor starts in the attributes mode.
    await expect(rows).toHaveCount(2);

    await page.getByTestId("toolbar-mode-entity").click();
    await expect(rows).toHaveCount(0);

    await page.getByTestId("toolbar-mode-attributes").click();
    await expect(rows).toHaveCount(2);

    await page.getByTestId("toolbar-mode-definition").click();
    await expect(rows).toHaveCount(0);

    await page.getByTestId("toolbar-mode-all").click();
    await expect(rows).toHaveCount(2);
  });

  test("an alert of the bottom panel selects and scrolls to its table", async ({
    page,
  }) => {
    await openEditor(page, "p5-alert-focus");
    await page.getByTestId("add-table-btn").click();
    await page.getByTestId("add-table-btn").click();

    // Give the second table the name of the first: the validator complains.
    const panel = page.getByTestId("edit-panel");
    const input = panel.getByTestId("table-physical-name");
    await input.fill("table");
    await input.blur();

    const alert = page.locator('[data-testid="alert-item"]', {
      hasText: "table.duplicate_name",
    });
    await expect(alert).toHaveCount(1);
    await alert.click();

    // The issue names the second table: the click selects it and scrolls
    // the canvas to its position.
    const tables = await bridgeTables(page);
    const duplicate = tables[1];
    await expect(canvasTable(page, duplicate.id)).toHaveClass(/is-selected/);
    await expect(page.getByTestId("canvas-content")).toHaveAttribute(
      "transform",
      focusTransform(duplicate.x, duplicate.y),
    );
  });
});
