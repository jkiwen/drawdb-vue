import { expect, test } from "@playwright/test";

/**
 * The performance tests of the canvas.
 *
 * The canvas only draws the tables that lie inside of the viewport, so that a
 * diagram with a hundred tables stays fluent.
 */

/** The number of the tables of the performance tests. */
const TABLE_COUNT = 100;

/** The time, in milliseconds, that a drag of the canvas may take. */
const DRAG_BUDGET_MS = 500;

test.describe("performance", () => {
  test("draws a hundred tables", async ({ page }) => {
    await page.goto("/editor/perf-1");

    for (let index = 0; index < TABLE_COUNT; index += 1) {
      await page.getByTestId("add-table-btn").click();
    }

    const tables = page.locator('[data-testid="canvas"] [data-testid^="table-"]');
    await expect(tables).toHaveCount(TABLE_COUNT);
  });

  test("only draws the tables that lie inside of the viewport", async ({ page }) => {
    await page.goto("/editor/perf-2");

    for (let index = 0; index < TABLE_COUNT; index += 1) {
      await page.getByTestId("add-table-btn").click();
    }

    // The canvas is small, so most of the tables lie outside of it.
    const drawn = await page
      .locator('[data-testid="canvas"] [data-testid^="table-"]')
      .count();

    expect(drawn).toBeLessThan(TABLE_COUNT);
  });

  test("drags a table without a delay", async ({ page }) => {
    await page.goto("/editor/perf-3");

    await page.getByTestId("add-table-btn").click();
    const table = page
      .locator('[data-testid="canvas"] [data-testid^="table-"]')
      .first();
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
