import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");

/** The maximum number of lines of a source file. */
export const LINE_LIMIT = 300;

const SOURCE_EXTENSIONS = [".ts", ".vue"];

/** The number of lines of a text. */
export function countLines(content: string): number {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

/** Every source file of a tree. */
export function collectSources(dir: string, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      collectSources(path, found);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      found.push(path);
    }
  }
  return found;
}

/** The files of a tree that are longer than the limit. */
export function findLongFiles(root: string, limit: number = LINE_LIMIT): string[] {
  return collectSources(root)
    // A specification is not a module of the product: it has no line limit.
    .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.vue"))
    .filter((path) => countLines(readFileSync(path, "utf-8")) > limit)
    .map((path) => relative(ROOT, path));
}

test("no sdk file is longer than 300 lines", () => {
  const long = findLongFiles(resolve(ROOT, "packages/sdk/src"));
  assert.deepEqual(long, [], `the files of the sdk are too long: ${long.join(", ")}`);
});

test("no app file is longer than 300 lines", () => {
  const long = findLongFiles(resolve(ROOT, "packages/app/src"));
  assert.deepEqual(long, [], `the files of the app are too long: ${long.join(", ")}`);
});

test("the check detects a file that is too long", () => {
  const dir = mkdtempSync(join(tmpdir(), "drawdb-constraints-"));
  try {
    mkdirSync(join(dir, "nested"));
    const long = join(dir, "nested", "long.ts");
    writeFileSync(long, `${"const x = 1;\n".repeat(301)}`);
    writeFileSync(join(dir, "short.ts"), "const y = 2;\n");

    const found = findLongFiles(dir, LINE_LIMIT);
    assert.equal(found.length, 1, "the long file was not detected");
    assert.match(found[0], /long\.ts$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
