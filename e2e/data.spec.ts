import { expect, test } from "@playwright/test";
import { canvasTables, waitForEditor } from "./helpers.ts";

/**
 * The tests of the data of a diagram.
 *
 * They cover the dialects of the SQL, the DBML and the JSON: the editor reads
 * them and writes them back.
 */

/** Opens the editor of a diagram that only the test knows. */
async function openEditor(
  page: import("@playwright/test").Page,
  id: string,
): Promise<void> {
  await page.goto(`/editor/${id}`);
  await waitForEditor(page);
}

/** The SQL of the diagram the editor shows. */
async function exportSql(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const found = (
      window as unknown as { __DRAWDB__?: { exportSql(): string } }
    ).__DRAWDB__;
    return found?.exportSql() ?? "";
  });
}

/** The DBML of the diagram the editor shows. */
async function exportDbml(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const found = (
      window as unknown as { __DRAWDB__?: { exportDbml(): string } }
    ).__DRAWDB__;
    return found?.exportDbml() ?? "";
  });
}

/** Imports a script of SQL into the diagram of the editor. */
async function importSql(
  page: import("@playwright/test").Page,
  sql: string,
  database: string,
): Promise<void> {
  await page.evaluate(
    ({ source, dialect }) => {
      const found = (
        window as unknown as {
          __DRAWDB__?: { importSql(sql: string, database?: string): unknown };
        }
      ).__DRAWDB__;
      found?.importSql(source, dialect);
    },
    { source: sql, dialect: database },
  );
}

test.describe("the data of a diagram", () => {
  test("imports the SQL of MySQL", async ({ page }) => {
    await openEditor(page, "data-mysql");

    await importSql(
      page,
      "CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255));",
      "mysql",
    );

    const diagram = await page.evaluate(() => {
      const current = (
        window as unknown as {
          __DRAWDB__?: { getDiagram(): { tables?: { name: string }[] } };
        }
      ).__DRAWDB__;
      return current?.getDiagram().tables?.map((table) => table.name) ?? [];
    });

    expect(diagram).toContain("users");
    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("imports the SQL of PostgreSQL", async ({ page }) => {
    await openEditor(page, "data-postgres");

    await importSql(
      page,
      "CREATE TABLE orders (id SERIAL PRIMARY KEY, total NUMERIC(10,2));",
      "postgres",
    );

    const tables = await page.evaluate(() => {
      const found = (
        window as unknown as {
          __DRAWDB__?: { getDiagram(): { tables?: { name: string }[] } };
        }
      ).__DRAWDB__;
      return found?.getDiagram().tables?.map((table) => table.name) ?? [];
    });

    expect(tables).toContain("orders");
  });

  test("imports the SQL of SQLite", async ({ page }) => {
    await openEditor(page, "data-sqlite");

    await importSql(
      page,
      "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);",
      "sqlite",
    );

    const tables = await page.evaluate(() => {
      const found = (
        window as unknown as {
          __DRAWDB__?: { getDiagram(): { tables?: { name: string }[] } };
        }
      ).__DRAWDB__;
      return found?.getDiagram().tables?.map((table) => table.name) ?? [];
    });

    expect(tables).toContain("notes");
  });

  test("writes the SQL of the diagram", async ({ page }) => {
    await openEditor(page, "data-export-sql");

    await importSql(
      page,
      "CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(80));",
      "mysql",
    );

    const sql = await exportSql(page);

    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("customers");
  });

  test("writes the DBML of the diagram", async ({ page }) => {
    await openEditor(page, "data-export-dbml");

    await importSql(
      page,
      "CREATE TABLE products (id INT PRIMARY KEY, title VARCHAR(80));",
      "mysql",
    );

    const dbml = await exportDbml(page);

    expect(dbml).toContain("Table products");
  });

  test("imports a diagram through the wizard", async ({ page }) => {
    await openEditor(page, "data-import-dialog");

    await page.getByTestId("menu-file").click();
    await page.getByText("Import SQL").click();

    // The wizard replaced the dialog in P8: it reads, reports, asks where the
    // tables go, and only then touches the diagram.
    await expect(page.getByTestId("import-wizard")).toBeVisible();
    await expect(page.getByTestId("import-format-sql")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page
      .getByTestId("import-text")
      .fill("CREATE TABLE invoices (id INT PRIMARY KEY);");
    await page.getByTestId("import-next").click();

    await expect(page.getByTestId("import-step-report")).toBeVisible();
    await expect(page.getByTestId("import-count-tables")).toHaveText("1");

    await page.getByTestId("import-next").click();
    await expect(page.getByTestId("import-step-target")).toBeVisible();
    await page.getByTestId("import-next").click();
    await expect(page.getByTestId("import-step-conflict")).toBeVisible();
    await page.getByTestId("import-apply").click();

    await expect(page.getByTestId("import-step-apply")).toBeVisible();
    await page.getByTestId("import-result-close").click();
    await expect(page.getByTestId("import-wizard")).toHaveCount(0);

    await expect(canvasTables(page)).toHaveCount(1);
  });

  test("reports the error of an invalid script", async ({ page }) => {
    await openEditor(page, "data-import-error");

    await page.getByTestId("menu-file").click();
    await page.getByText("Import SQL").click();

    await page.getByTestId("import-text").fill("THIS IS NOT SQL");
    await page.getByTestId("import-next").click();

    // A script that cannot be read blocks the wizard on the report step.
    await expect(page.getByTestId("import-step-report")).toBeVisible();
    await expect(page.getByTestId("import-issue").first()).toBeVisible();
    await expect(page.getByTestId("import-next")).toBeDisabled();
    await expect(canvasTables(page)).toHaveCount(0);
  });
});
