// One-off extraction: pull per-database type name lists out of the React
// drawDB `src/data/datatypes.js` so the SDK registry can be generated from
// the same source of truth.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "D:/dev/repos/github/drawdb";
const src = fs.readFileSync(path.join(root, "src/data/datatypes.js"), "utf8");

function keysOfBlock(blockName) {
  const start = src.indexOf(`const ${blockName} = {`);
  if (start === -1) return null;
  let i = src.indexOf("{", start);
  let depth = 0;
  const keys = [];
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      depth++;
      // capture the key name that opens this brace
      const head = src.slice(src.lastIndexOf("\n", i) + 1, i);
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(head);
      if (depth === 2 && m) keys.push(m[1]);
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return keys;
}

const blocks = {
  generic: keysOfBlock("defaultTypesBase"),
  mysql: keysOfBlock("mysqlTypesBase"),
  postgres: keysOfBlock("postgresTypesBase"),
  sqlite: keysOfBlock("sqliteTypesBase"),
  mssql: keysOfBlock("mssqlTypesBase"),
  oraclesql: keysOfBlock("oraclesqlTypesBase"),
  mariadb: keysOfBlock("mariadbTypesBase"),
};

// mariadb = mysql + mariadb-specific
if (blocks.mariadb) {
  const extra = blocks.mariadb;
  const merged = [...new Set([...(blocks.mysql ?? []), ...extra])];
  blocks.mariadb = merged;
}

const out = {};
for (const [db, keys] of Object.entries(blocks)) {
  if (!keys) {
    console.error(`missing block for ${db}`);
    continue;
  }
  out[db] = keys;
  console.error(`${db}: ${keys.length}`);
}

fs.writeFileSync(
  path.join(root, "sdk-workspace/scripts/types-extracted.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.error("wrote sdk-workspace/scripts/types-extracted.json");
