/**
 * Reads one erwin XML file and prints what the importer made of it.
 *
 *   node --experimental-strip-types scripts/erwin-probe.mjs <file.xml>
 *
 * It is the first step of adding a sample: it shows the version, the names the
 * reader found, and everything it could not turn into a value. A real file that
 * reports its entities as "unknown-element" is telling us the alias table needs
 * the name the other erwin version uses.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { importErwinXml } from "../packages/core/src/erwin/erwin-import.ts";

const target = process.argv[2];
if (!target) {
  console.error("usage: node --experimental-strip-types scripts/erwin-probe.mjs <file.xml>");
  process.exit(2);
}

const source = readFileSync(target, "utf8");
const { diagram, report } = importErwinXml(source);

console.log(`file        ${basename(target)}`);
console.log(`version     ${report.version}`);
console.log(`entities    ${report.entities}`);
console.log(`attributes  ${report.attributes}`);
console.log(`fields      ${report.fields}`);
console.log(`domains     ${report.domains}`);
console.log(`relations   ${report.relationships}`);
console.log(`skipped     ${report.skipped.length}`);
console.log();

for (const table of diagram.tables) {
  const attributes = table.logical.attributes.map((attribute) => attribute.name).slice(0, 4).join(" | ");
  const fields = table.fields.map((field) => `${field.name}:${field.fieldType.type}`).slice(0, 4).join(" | ");
  console.log(`table       ${table.name}  (logical: ${table.logical.name})`);
  console.log(`  attr      ${attributes}${table.logical.attributes.length > 4 ? " | …" : ""}`);
  console.log(`  field     ${fields}${table.fields.length > 4 ? " | …" : ""}`);
}

if (report.skipped.length > 0) {
  console.log();
  for (const skip of report.skipped.slice(0, 25)) {
    console.log(`skip        ${skip.path} — ${skip.sourceName} (${skip.reason})`);
  }
  if (report.skipped.length > 25) console.log(`skip        … and ${report.skipped.length - 25} more`);
}

if (report.notes.length > 0) {
  console.log();
  for (const note of report.notes) console.log(`note        ${note}`);
}
