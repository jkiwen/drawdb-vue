import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const PLAN = readFileSync(resolve(ROOT, "docs/plan.md"), "utf-8");

/** The sections of the plan, with the task number and the status line. */
function sections(): { task: number; title: string; status: string | null }[] {
  const found: { task: number; title: string; status: string | null }[] = [];
  let current: { task: number; title: string; status: string | null } | null =
    null;
  // Tolerate CRLF checkouts (Windows with core.autocrlf=true).
  for (const line of PLAN.split(/\r?\n/)) {
    const heading = /^## Task (\d+):\s*(.*)$/.exec(line);
    if (heading) {
      current = {
        task: Number(heading[1]),
        title: heading[2],
        status: null,
      };
      found.push(current);
      continue;
    }
    if (!current) continue;
    const status = /^\*\*Status:\*\*\s*(.*)$/.exec(line);
    if (status) current.status = status[1];
  }
  return found;
}

test("the plan has the twenty tasks", () => {
  const tasks = sections();
  assert.equal(tasks.length, 20, "the plan does not have the twenty tasks");
  assert.deepEqual(
    tasks.map((section) => section.task),
    Array.from({ length: 20 }, (_, index) => index + 1),
    "the tasks of the plan are not numbered in order",
  );
});

test("every task of the plan carries its state", () => {
  for (const section of sections()) {
    assert.ok(
      section.status,
      `task ${section.task} has no status line under its heading`,
    );
    assert.match(
      section.status,
      /complete/i,
      `task ${section.task} is not marked as complete: ${section.status}`,
    );
  }
});

test("the status of a task names its commit", () => {
  for (const section of sections()) {
    assert.match(
      section.status ?? "",
      /commit `[0-9a-f]{7,40}`/,
      `the status of task ${section.task} does not name its commit`,
    );
  }
});

test("no step of the plan is open", () => {
  const open = PLAN.split("\n").filter((line) => /^\s*- \[ \]/.test(line));
  assert.deepEqual(
    open,
    [],
    `the plan still has open steps: ${open.join(" | ")}`,
  );
});

test("the plan explains how a task is marked", () => {
  assert.match(PLAN, /scripts\/plan-status\.mjs/);
});

test("the script of the plan reports the twenty finished tasks", async () => {
  const { readState } = await import("./plan-status.mjs");
  const state = readState(resolve(ROOT, "docs/plan.md"));
  assert.equal(state.length, 20, "the script does not report twenty tasks");
  for (const section of state) {
    assert.ok(
      section.status,
      `task ${section.task} has no status in the state of the plan`,
    );
    assert.equal(
      section.open,
      0,
      `task ${section.task} still has ${section.open} open steps`,
    );
  }
});

test("the script reads an alternative plan", async () => {
  const { readState } = await import("./plan-status.mjs");
  const state = readState(
    resolve(ROOT, "docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md"),
  );
  assert.equal(state.length, 12, "the parity plan does not have the twelve tasks");
  assert.deepEqual(
    state.map((section) => section.task),
    Array.from({ length: 12 }, (_, index) => index + 21),
    "the tasks of the parity plan are not numbered from 21 to 32",
  );
});

test("the script tolerates CRLF line endings", async () => {
  const { readSections } = await import("./plan-status.mjs");
  const text = [
    "# Plan",
    "",
    "## Task 1: A task",
    "",
    "**Status:** complete — commit `abc1234`",
    "",
    "- [x] **Step 1: done**",
    "",
  ].join("\r\n");
  const state = readSections(text);
  assert.equal(state.length, 1, "the CRLF plan has one task");
  assert.equal(state[0].task, 1);
  assert.ok(state[0].status, "the CRLF task has a status line");
  assert.equal(state[0].steps, 1);
  assert.equal(state[0].open, 0);
});
