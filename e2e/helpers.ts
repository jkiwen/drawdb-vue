import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The helpers of the end to end tests.
 *
 * The canvas draws the tables as SVG groups. The header of a table, its name
 * and its buttons live in a `foreignObject` and carry their own test ids, so
 * a selector has to name the group of the table and not just the prefix.
 */
export function canvasTables(page: Page): Locator {
  return page.locator('[data-testid="canvas"] g[data-testid^="table-"]');
}

/** The table rows of the outline tree of the left panel. */
export function outlineTables(page: Page): Locator {
  return page.locator(
    '[data-testid="outline-tree"] [data-testid^="outline-row-table:"]',
  );
}

/** One row of the outline tree, named by the id of its node. */
export function outlineRow(page: Page, nodeId: string): Locator {
  return page.getByTestId(`outline-row-${nodeId}`);
}

/** Waits until the editor has finished its first render. */
export async function waitForEditor(page: Page): Promise<void> {
  await expect(page.getByTestId("editor-view")).toBeVisible();
  await expect(page.getByTestId("canvas")).toBeVisible();
}

/**
 * The text input of a Naive UI input.
 *
 * The input of Naive UI puts the test id on the wrapper of the element, so
 * that the test has to reach the input itself to type into it.
 */
export function textInput(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator("input");
}

/** Types a value into the text input of a Naive UI input. */
export async function fillInput(
  page: Page,
  testId: string,
  value: string,
): Promise<void> {
  const input = textInput(page, testId);
  await input.fill(value);
  // Naive UI commits the value when the input loses the focus.
  await input.blur();
}

/** The state of the last save, as it is shown in the header. */
export async function saveState(page: Page): Promise<string> {
  return (await page.getByTestId("save-state").innerText()).trim();
}
