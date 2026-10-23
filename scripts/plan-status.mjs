// The state of the tasks of the plan.
//
//   node scripts/plan-status.mjs                     shows the state of every task
//   node scripts/plan-status.mjs --task 21 \
//        --commit <hash> [--report docs/task-21-report.md]   marks a task as complete
//
// A task is complete when its heading carries a status line and every step of
// its section is checked. The script writes both.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLAN = resolve("docs/plan.md");

/**
 * The sections of a plan: the number of the task, its title, its status line
 * and the number of its steps.
 */
export function readSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    const heading = /^## Task (\d+):\s*(.*)$/.exec(line);
    if (heading) {
      current = {
        task: Number(heading[1]),
        title: heading[2],
        status: null,
        steps: 0,
        open: 0,
      };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const status = /^\*\*Status:\*\*\s*(.*)$/.exec(line);
    if (status) {
      current.status = status[1];
      continue;
    }
    if (/^- \[[ x]\] \*\*Step/.test(line)) {
      current.steps += 1;
      if (line.startsWith("- [ ]")) current.open += 1;
    }
  }
  return sections;
}

/** The state of the tasks of the plan in `planPath`. */
export function readState(planPath = PLAN) {
  return readSections(readFileSync(planPath, "utf-8"));
}

function parseArgs(argv) {
  const args = { task: null, commit: null, report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--task") {
      args.task = Number(value);
      index += 1;
    } else if (flag === "--commit") {
      args.commit = value;
      index += 1;
    } else if (flag === "--report") {
      args.report = value;
      index += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lines = readFileSync(PLAN, "utf-8").split("\n");
  const sections = readSections(lines.join("\n"));

  if (args.task === null) {
    console.log("Task  State     Steps  Title");
    for (const section of sections) {
      const state = section.status ? "complete" : "open";
      console.log(
        `${String(section.task).padStart(4)}  ${state.padEnd(8)}  ${String(section.steps - section.open).padStart(3)}/${section.steps}  ${section.title}`,
      );
    }
    return;
  }

  const section = sections.find((entry) => entry.task === args.task);
  if (!section) {
    console.error(`there is no task ${args.task} in the plan`);
    process.exit(1);
  }
  if (!args.commit) {
    console.error("--commit is required");
    process.exit(1);
  }

  const report = args.report ? ` · report: \`${args.report}\`` : "";
  const status = `**Status:** complete — commit \`${args.commit}\`${report}`;

  const out = [];
  let inside = false;
  let written = false;
  for (const line of lines) {
    if (/^## Task \d+:/.test(line)) {
      inside = new RegExp(`^## Task ${args.task}:`).test(line);
      if (inside) {
        out.push(line);
        out.push("");
        out.push(status);
        written = true;
        continue;
      }
    }
    if (inside && /^- \[ \] \*\*Step/.test(line)) {
      out.push(line.replace("- [ ] **Step", "- [x] **Step"));
      continue;
    }
    if (inside && /^\*\*Status:\*\*/.test(line)) continue;
    out.push(line);
  }

  if (!written) {
    console.error(`the heading of task ${args.task} was not found`);
    process.exit(1);
  }

  writeFileSync(PLAN, out.join("\n"), "utf-8");
  console.log(`task ${args.task} marked as complete (commit ${args.commit})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
