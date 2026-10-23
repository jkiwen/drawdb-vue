/**
 * Compiles the single file components of the SDK.
 *
 * `vue-tsc` emits the script of a `.vue` file as a separate `<name>.vue.js` module, but
 * the template of the component is missing there. This step replaces every emitted
 * `<name>.vue.js` with the component compiled by `@vue/compiler-sfc` (script + template
 * inlined as a render function) and rewrites the relative import specifiers of the
 * emitted modules so that they point at the files of the distribution:
 *
 * - `./Component.vue`  -> `./Component.vue.js`
 * - `./stores/ui.ts`   -> `./stores/ui.js`
 *
 * The script runs in-process (no child process is spawned) so that it also works in a
 * sandbox that blocks the process spawning of the esbuild service.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SDK = path.join(ROOT, "packages", "sdk");
const SRC = path.join(SDK, "src");
const DIST = path.join(SDK, "dist");

const require = createRequire(pathToFileURL(path.join(SDK, "package.json")));
const { parse, compileScript } = require("@vue/compiler-sfc");
const ts = require("typescript");

/** Collects every file of a directory that matches a predicate. */
async function collect(dir, predicate, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(full, predicate, found);
    } else if (predicate(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** Resolves a relative import specifier to the file of the distribution. */
function rewriteSpecifier(specifier, fromDir) {
  if (!specifier.startsWith(".")) return specifier;

  const stem = specifier.replace(/\.(vue|ts)$/, "");
  const base = path.resolve(fromDir, stem);
  const candidates = [
    [base + ".vue", stem + ".vue.js"],
    [base + ".ts", stem + ".js"],
    [base + ".css", stem + ".css"],
    [path.join(base, "index.ts"), stem + "/index.js"],
  ];

  for (const [source, target] of candidates) {
    if (existsSync(source)) {
      return target;
    }
  }

  if (specifier.endsWith(".vue")) return specifier + ".js";
  if (specifier.endsWith(".ts")) return specifier.slice(0, -3) + ".js";
  return specifier;
}

/** Rewrites the relative import specifiers of an emitted module. */
function rewriteImports(code, fromDir) {
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.[^"']*)\2/g,
    (match, keyword, quote, specifier) =>
      `${keyword}${quote}${rewriteSpecifier(specifier, fromDir)}${quote}`,
  );
}

/** Compiles one single file component into its runtime module. */
function compileComponent(file) {
  const source = readFileSync(file, "utf8");
  const { descriptor, errors } = parse(source, { filename: file });

  if (errors.length > 0) {
    throw new Error(`Failed to parse ${file}: ${errors[0].message}`);
  }

  const id = Buffer.from(file).toString("hex").slice(0, 8);
  const compiled = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: { compilerOptions: { mode: "module" } },
  });

  const transpiled = ts.transpileModule(compiled.content, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
    fileName: file,
  });

  return transpiled.outputText;
}

/** Copies a file into the distribution. */
async function copy(file, target) {
  await writeFile(target, await readFile(file));
}

async function main() {
  if (!existsSync(DIST)) {
    throw new Error(
      "The distribution is missing. Run `vue-tsc -p tsconfig.build.json --noCheck` first.",
    );
  }

  const components = await collect(
    SRC,
    (name) => name.endsWith(".vue") && !name.endsWith(".test.vue"),
  );
  const locales = await collect(SRC, (name) => name.endsWith(".json"));
  const stylesheets = await collect(SRC, (name) => name.endsWith(".css"));

  for (const file of locales) {
    const relative = path.relative(SRC, file);
    const target = path.join(DIST, relative);
    await copy(file, target);
  }

  for (const file of stylesheets) {
    const relative = path.relative(SRC, file);
    const target = path.join(DIST, relative);
    await copy(file, target);
  }

  for (const file of components) {
    const relative = path.relative(SRC, file);
    const target = path.join(DIST, relative + ".js");
    const code = rewriteImports(compileComponent(file), path.dirname(file));
    await writeFile(target, code);
  }

  // The import specifiers of the emitted TypeScript modules still point at the sources.
  for (const file of await collect(DIST, (name) => name.endsWith(".js"))) {
    const code = await readFile(file, "utf8");
    const rewritten = rewriteImports(code, path.dirname(file));
    if (rewritten !== code) {
      await writeFile(file, rewritten);
    }
  }

  const info = await stat(path.join(DIST, "index.js"));
  console.log(
    `SDK build finished: ${components.length} components, ${locales.length} locales, ${stylesheets.length} stylesheets, index.js ${info.size} bytes`,
  );
}

await main();
