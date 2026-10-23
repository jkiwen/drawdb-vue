// One-off extraction: pull per-database type tables out of the React drawDB
// `src/data/datatypes.js` so the SDK registry can be generated from the same
// source of truth.
//
// The React source declares every type as an object literal:
//
//   VARCHAR: {
//     type: "VARCHAR",
//     color: stringColor,
//     checkDefault: (field) => { ... },
//     hasCheck: true,
//     isSized: true,
//     hasPrecision: false,
//     hasQuotes: true,
//   },
//
// `checkDefault` contains braces, so a naive brace counter breaks. This
// script tracks string literals and comments while counting depth, which
// lets it slice each type entry out of the source text and then read the
// boolean flags out of the slice.
//
// Output: scripts/types-extracted.json
//   { "<database>": { "<TYPE>": { isSized, hasPrecision, hasQuotes, ... } } }
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "D:/dev/repos/github/drawdb";
const src = fs.readFileSync(path.join(root, "src/data/datatypes.js"), "utf8");

const FLAGS = [
  "isSized",
  "hasPrecision",
  "hasQuotes",
  "canIncrement",
  "signed",
  "hasCheck",
  "noDefault",
];

/**
 * Extract `{ TYPE_NAME: { ...flags } }` entries from a top-level block.
 *
 * The React source keeps every type entry at a fixed indentation: the key
 * sits on a line with exactly two spaces of indent and the entry body is
 * indented four spaces. A line-based split on that shape is far more robust
 * than counting braces, because `checkDefault` bodies contain braces of
 * their own.
 */
function extractBlock(blockName) {
  const marker = `const ${blockName} = {`;
  const start = src.indexOf(marker);
  if (start === -1) return null;

  const lines = src.slice(start).split(/\r?\n/);
  const entries = {};
  let current = null;
  let buffer = [];

  const flush = () => {
    if (!current) return;
    const text = buffer.join("\n");
    const flags = {};
    for (const flag of FLAGS) {
      const m = new RegExp(`^\\s*${flag}:\\s*(true|false)\\b`, "m").exec(text);
      if (m) flags[flag] = m[1] === "true";
    }
    entries[current] = flags;
    current = null;
    buffer = [];
  };

  for (const line of lines) {
    if (current === null) {
      const m = /^ {2}([A-Za-z_][A-Za-z0-9_]*):\s*\{$/.exec(line);
      if (m) {
        current = m[1];
        buffer = [];
      }
      if (/^\};?\s*$/.test(line)) break;
      continue;
    }

    // Inside an entry: a new key at two-space indent closes the entry.
    if (/^ {2}[A-Za-z_][A-Za-z0-9_]*:\s*\{$/.test(line)) {
      flush();
      const m = /^ {2}([A-Za-z_][A-Za-z0-9_]*):\s*\{$/.exec(line);
      current = m[1];
      buffer = [];
      continue;
    }

    buffer.push(line);
    if (/^ {2}\},?\s*$/.test(line)) flush();
  }

  flush();
  return entries;
}

const blocks = {
  generic: extractBlock("defaultTypesBase"),
  mysql: extractBlock("mysqlTypesBase"),
  postgres: extractBlock("postgresTypesBase"),
  sqlite: extractBlock("sqliteTypesBase"),
  mssql: extractBlock("mssqlTypesBase"),
  oraclesql: extractBlock("oraclesqlTypesBase"),
  mariadb: extractBlock("mariadbTypesBase"),
};

// mariadb = mysql + mariadb-specific
if (blocks.mariadb) {
  const merged = { ...(blocks.mysql ?? {}), ...blocks.mariadb };
  blocks.mariadb = merged;
}

const out = {};
for (const [db, entries] of Object.entries(blocks)) {
  if (!entries) {
    console.error(`missing block for ${db}`);
    continue;
  }
  out[db] = entries;
  console.error(`${db}: ${Object.keys(entries).length}`);
}

fs.writeFileSync(
  path.join(root, "sdk-workspace/scripts/types-extracted.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.error("wrote sdk-workspace/scripts/types-extracted.json");
