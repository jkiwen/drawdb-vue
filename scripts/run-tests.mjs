/**
 * Workspace test runner.
 *
 * The sandboxed Windows environment blocks the child processes that
 * `node --test` and vitest spawn, so every spec file is imported into a
 * single process instead. The `node:test` runner still reports the results
 * and fails the process when a spec fails.
 *
 * Usage: node --experimental-strip-types scripts/run-tests.mjs [filter]
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOTS = [
  join(ROOT, "packages", "core", "src"),
  join(ROOT, "packages", "sdk", "src"),
  join(ROOT, "packages", "app", "src"),
  join(ROOT, "scripts"),
];

const filter = process.argv[2];

function collect(dir) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      found.push(...collect(full));
    } else if (entry.endsWith(".test.ts") && entry.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

const files = SOURCE_ROOTS.flatMap(collect)
  .filter((file) => !filter || file.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(
    filter ? `No test files matched "${filter}".` : "No test files found.",
  );
  process.exit(1);
}

console.log(`Running ${files.length} spec file(s) in a single process.`);

for (const file of files) {
  await import(pathToFileURL(file).href);
}
