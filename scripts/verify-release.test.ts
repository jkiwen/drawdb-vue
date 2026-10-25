import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

function readManifest(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

test("the changelog announces the release", () => {
  assert.ok(
    existsSync(resolve(ROOT, "CHANGELOG.md")),
    "CHANGELOG.md is missing",
  );
  assert.match(read("CHANGELOG.md"), /##\s+0\.2\.0/);
});

test("the packages are published with the version of the release", () => {
  for (const manifest of [
    "packages/core/package.json",
    "packages/sdk/package.json",
    "packages/app/package.json",
  ]) {
    assert.equal(
      readManifest(manifest)["version"],
      "0.2.0",
      `${manifest} is not at the version of the release`,
    );
  }
});

test("the core and the SDK are publishable", () => {
  for (const manifest of ["packages/core/package.json", "packages/sdk/package.json"]) {
    const packageJson = readManifest(manifest);
    assert.equal(packageJson["private"], undefined, `${manifest} is private`);
    assert.ok(packageJson["exports"], `${manifest} has no exports`);
    assert.ok(packageJson["license"], `${manifest} has no license`);
  }
});

test("the continuous integration runs the checks, the build and the tests", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /pnpm run typecheck/);
  assert.match(workflow, /pnpm run build/);
  assert.match(workflow, /pnpm run test/);
});

test("the release workflow packs the packages and does not publish them", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /tags:/);
  assert.match(workflow, /pnpm run pack:packages/);
  assert.doesNotMatch(workflow, /pnpm .*publish/);
});

test("the packages can be packed locally", () => {
  const scripts = readManifest("package.json")["scripts"] as Record<
    string,
    string
  >;
  assert.match(scripts["pack:packages"], /@drawdb\/core pack/);
  assert.match(scripts["pack:packages"], /@drawdb\/vue-sdk pack/);
});

test("the example embeds the editor", () => {
  assert.ok(existsSync(resolve(ROOT, "examples/vue-embed/src/App.vue")));
  // The editor may sit in the entry component of the example or in the
  // harness it mounts, so both are looked at.
  const example = [
    read("examples/vue-embed/src/App.vue"),
    read("examples/vue-embed/src/AppHarness.vue"),
  ].join("\n");
  assert.match(example, /DrawDBEditor/);
  assert.ok(existsSync(resolve(ROOT, "examples/vue-embed/README.md")));
});
