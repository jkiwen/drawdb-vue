import { expect, test, type Page } from "@playwright/test";
import { waitForEditor } from "./helpers.ts";

/**
 * The area of the canvas, driven in a real browser.
 *
 * The area is drawn as a group of the SVG, so the browser is the only place
 * that can tell whether a click really lands on the area and whether the
 * handle in its corner is the element the pointer grabs.
 */

async function openEditor(page: Page, id: string): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** The group that draws the area. */
function areaGroup(page: Page) {
  return page.locator('[data-testid="canvas"] g.ddb-area');
}

/** The outline of the area, which carries the size it was resized to. */
function areaOutline(page: Page) {
  return areaGroup(page).locator("rect.ddb-area__rect");
}

/** The handle that resizes the area. */
function areaHandle(page: Page) {
  return page.locator('[data-testid="canvas"] g.ddb-area__resize');
}

/** Clicks the middle of the area, away from its handle. */
async function clickInsideTheArea(page: Page): Promise<void> {
  const box = await areaGroup(page).boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + 40, box.y + 40);
}

test.describe("the area of the canvas", () => {
  test("selects the area that is clicked, and the canvas clears it", async ({
    page,
  }) => {
    await openEditor(page, "e2e-area-select");

    await page.getByTestId("add-area-btn").click();
    await expect(areaGroup(page)).toHaveCount(1);
    // The area that was just added is the selected one.
    await expect(areaGroup(page)).toHaveClass(/is-selected/);

    // The floating toolbar covers the top-left corner of the canvas, so the
    // click that clears the selection lands on the empty bottom-right corner.
    const canvas = page.locator('[data-testid="canvas"]');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await canvas.click({
      position: { x: box.width - 20, y: box.height - 20 },
    });
    await expect(areaGroup(page)).not.toHaveClass(/is-selected/);

    await clickInsideTheArea(page);
    await expect(areaGroup(page)).toHaveClass(/is-selected/);
  });

  test("resizes the area with the handle in its corner", async ({ page }) => {
    await openEditor(page, "e2e-area-resize");

    await page.getByTestId("add-area-btn").click();
    await expect(areaOutline(page)).toHaveAttribute("width", "240");
    await expect(areaOutline(page)).toHaveAttribute("height", "160");

    const handle = await areaHandle(page).boundingBox();
    expect(handle).not.toBeNull();
    if (!handle) return;

    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 40, { steps: 6 });
    // The area follows the pointer while the button is still down, and the
    // release keeps the size the drag had drawn.
    await expect(areaOutline(page)).toHaveAttribute("width", "300");
    await expect(areaOutline(page)).toHaveAttribute("height", "200");
    await page.mouse.up();

    await expect(areaOutline(page)).toHaveAttribute("width", "300");
    await expect(areaOutline(page)).toHaveAttribute("height", "200");
    // The resize neither loses the area nor its selection.
    await expect(areaGroup(page)).toHaveCount(1);
    await expect(areaGroup(page)).toHaveClass(/is-selected/);
  });

  test("moves the area that is dragged", async ({ page }) => {
    await openEditor(page, "e2e-area-move");

    await page.getByTestId("add-area-btn").click();
    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(100 100)",
    );

    const box = await areaGroup(page).boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 6 });
    // The area follows the pointer while the button is still down.
    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(160 140)",
    );
    await page.mouse.up();

    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(160 140)",
    );
    await expect(areaGroup(page)).toHaveClass(/is-selected/);

    // The move is one change, which the history takes back in one step.
    await page.getByTestId("undo-btn").click();
    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(100 100)",
    );
  });

  test("takes the table that sits in the area along with it", async ({
    page,
  }) => {
    await openEditor(page, "e2e-area-carries-table");

    await page.getByTestId("add-table-btn").click();
    const table = page.locator('[data-testid="canvas"] g[data-testid^="table-"]');
    await expect(table).toHaveAttribute("transform", "translate(100 100)");

    await page.getByTestId("add-area-btn").click();
    await expect(areaGroup(page)).toHaveCount(1);

    const box = await areaGroup(page).boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // The bottom right of the area is outside the table, so the pointer grabs
    // the area there instead of the table it holds.
    const x = box.x + box.width - 20;
    const y = box.y + box.height - 20;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 40, { steps: 6 });
    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(160 140)",
    );
    await expect(table).toHaveAttribute("transform", "translate(160 140)");
    await page.mouse.up();

    await expect(table).toHaveAttribute("transform", "translate(160 140)");

    // The area and the table it holds are one change of the history.
    await page.getByTestId("undo-btn").click();
    await expect(areaGroup(page)).toHaveAttribute(
      "transform",
      "translate(100 100)",
    );
    await expect(table).toHaveAttribute("transform", "translate(100 100)");
  });

  test("keeps the size of the area when the handle is only pressed", async ({
    page,
  }) => {
    await openEditor(page, "e2e-area-press");

    await page.getByTestId("add-area-btn").click();
    await expect(areaOutline(page)).toHaveAttribute("width", "240");

    const handle = await areaHandle(page).boundingBox();
    expect(handle).not.toBeNull();
    if (!handle) return;

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    await expect(areaOutline(page)).toHaveAttribute("width", "240");
    await expect(areaOutline(page)).toHaveAttribute("height", "160");
  });

  test("leaves the tables selectable next to the area", async ({ page }) => {
    await openEditor(page, "e2e-area-tables");

    await page.getByTestId("add-table-btn").click();
    const table = page.locator('[data-testid="canvas"] g[data-testid^="table-"]');
    await expect(table).toHaveCount(1);

    // The canvas draws the areas under the tables, so the second area — the
    // one the table does not cover — is the one a click can reach.
    await page.getByTestId("add-area-btn").click();
    await page.getByTestId("add-area-btn").click();
    await expect(areaGroup(page)).toHaveCount(2);

    const secondArea = areaGroup(page).nth(1);
    const box = await secondArea.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.click(box.x + 40, box.y + 40);

    await expect(secondArea).toHaveClass(/is-selected/);
    // The table keeps its own selection state while the area is selected.
    await expect(
      page.locator('[data-testid="canvas"] .ddb-table__body.is-selected'),
    ).toHaveCount(0);
    await expect(table).toHaveCount(1);

    const tableBox = await table.boundingBox();
    expect(tableBox).not.toBeNull();
    if (!tableBox) return;
    await page.mouse.click(tableBox.x + 60, tableBox.y + 12);

    await expect(
      page.locator('[data-testid="canvas"] .ddb-table__body.is-selected'),
    ).toHaveCount(1);
    await expect(secondArea).not.toHaveClass(/is-selected/);
  });
});
