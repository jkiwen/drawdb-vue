import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

test("the packages are at version 0.2.0", () => {
  const manifests = [
    "package.json",
    "packages/core/package.json",
    "packages/sdk/package.json",
    "packages/app/package.json",
  ];
  for (const manifest of manifests) {
    const parsed = JSON.parse(read(manifest)) as { version?: string };
    assert.equal(parsed.version, "0.2.0", `${manifest} is not at 0.2.0`);
  }
});

test("the changelog documents 0.2.0", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /##\s+0\.2\.0/, "CHANGELOG.md has no 0.2.0 section");
  const section = changelog.split(/##\s+0\.2\.0/)[1] ?? "";
  const capabilities = [
    "quality",
    "layout",
    "json",
    "canvas",
    "side panel",
    "dialog",
  ];
  for (const capability of capabilities) {
    assert.ok(
      section.toLowerCase().includes(capability),
      `the 0.2.0 section does not mention ${capability}`,
    );
  }
});
