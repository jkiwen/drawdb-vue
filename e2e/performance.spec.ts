import { expect, test } from "@playwright/test";
import { canvasTables, outlineTables, waitForEditor } from "./helpers.ts";

/**
 * The performance tests of the canvas.
 *
 * The canvas only draws the tables that lie inside of the viewport, so that a
 * diagram with a hundred tables stays fluent. The outline tree of the left
 * panel keeps every table of the diagram, the canvas only the ones the user
 * can see.
 */

/** The number of the tables of the performance tests. */
const TABLE_COUNT = 100;

/** The time, in milliseconds, that a drag of the canvas may take. */
const DRAG_BUDGET_MS = 500;

/** Adds a number of tables to the diagram of the editor. */
async function addTables(page: import("@playwright/test").Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.getByTestId("add-table-btn").click();
  }
}

test.describe("performance", () => {
  test("draws a hundred tables", async ({ page }) => {
    await page.goto("/editor/perf-1");
    await waitForEditor(page);

    await addTables(page, TABLE_COUNT);

    // The outline lists every table of the diagram: the count badge of the
    // tables category says so, while the virtual scroll only keeps the rows
    // around the viewport in the DOM (the panel has followed the selection to
    // the last added table, so the test scrolls back to its top).
    await outlineTables(page).last().hover();
    await page.mouse.wheel(0, -100_000);
    await expect(page.getByTestId("outline-badge-cat:tables")).toHaveText(
      String(TABLE_COUNT),
    );
    expect(await outlineTables(page).count()).toBeLessThan(TABLE_COUNT);

    // The canvas draws the tables that lie inside of the viewport, so it shows
    // a part of them. The tables of the list that are outside are not drawn.
    const drawn = await canvasTables(page).count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(TABLE_COUNT);
  });

  test("only draws the tables that lie inside of the viewport", async ({ page }) => {
    await page.goto("/editor/perf-2");
    await waitForEditor(page);

    await addTables(page, TABLE_COUNT);

    // The canvas is small, so most of the tables lie outside of it.
    const drawn = await canvasTables(page).count();

    expect(drawn).toBeLessThan(TABLE_COUNT);
  });

  test("drags a table without a delay", async ({ page }) => {
    await page.goto("/editor/perf-3");
    await waitForEditor(page);

    await page.getByTestId("add-table-btn").click();
    const table = canvasTables(page).first();
    await expect(table).toBeVisible();

    const box = await table.boundingBox();
    expect(box).not.toBeNull();

    const start = { x: box!.x + box!.width / 2, y: box!.y + 10 };

    const duration = await page.evaluate(
      async ({ x, y }) => {
        const started = performance.now();
        const canvas = document.querySelector('[data-testid="canvas"]');
        if (!canvas) {
          return 0;
        }
        const send = (type: string, clientX: number, clientY: number) => {
          canvas.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              clientX,
              clientY,
              pointerId: 1,
            }),
          );
        };
        send("pointerdown", x, y);
        for (let step = 1; step <= 10; step += 1) {
          send("pointermove", x + step * 10, y + step * 5);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        send("pointerup", x + 100, y + 50);
        return performance.now() - started;
      },
      start,
    );

    expect(duration).toBeLessThan(DRAG_BUDGET_MS);
  });
});
