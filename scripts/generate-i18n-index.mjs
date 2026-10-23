/**
 * Writes the imports of the locales into the module of the translations.
 *
 * The module of the SDK imports every locale statically, so that a bundler
 * can include them and so that the module works without a file system. The
 * list of the imports is written by this script, between the two markers of
 * `packages/sdk/src/i18n/index.ts`.
 *
 * Usage: node scripts/generate-i18n-index.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const localesDir = path.join(root, "packages", "sdk", "src", "i18n", "locales");
const files = (await readdir(localesDir)).filter((f) => f.endsWith(".json")).sort();
const codes = files.map((f) => f.replace(/\.json$/, ""));

// A code can be a word of the language, "as" for example, so the name of the
// import always starts with a prefix.
const name = (code) => `locale_${code.replace(/-/g, "_")}`;

const imports = codes
  .map((code) => `import ${name(code)} from "./locales/${code}.json" with { type: "json" };`)
  .join("\n");

const entries = codes.map((code) => `  "${code}": ${name(code)},`).join("\n");

const file = path.join(root, "packages", "sdk", "src", "i18n", "index.ts");
let source = await readFile(file, "utf8");

if (!source.includes("/* === generated imports === */")) {
  throw new Error(
    `the marker of the generated imports is missing in ${path.relative(root, file)}`,
  );
}

source = source.replace(
  "/* === generated imports === */",
  `${imports}\n\n/* === generated messages === */`,
);
source = source.replace(
  "/* === generated messages === */",
  `/** The messages of every locale. */\nexport const localeMessages: Record<string, Record<string, string>> = {\n${entries}\n};`,
);

await writeFile(file, source, "utf8");
console.log("wrote", codes.length, "imports");
