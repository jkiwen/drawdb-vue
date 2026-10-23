/**
 * Node module hooks that compile Vue single file components on the fly.
 *
 * The workspace test runner cannot use vitest, because the sandbox blocks the
 * child processes that vitest spawns. The components are therefore compiled
 * here: `@vue/compiler-sfc` turns a `.vue` file into a module and the
 * TypeScript compiler removes the type annotations from the script block.
 *
 * The loader only exists for the tests. The production build uses
 * `@vitejs/plugin-vue`, which does the same job inside Vite.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(import.meta.dirname, "..");

// The compiler lives in the SDK package, so the lookup has to start there.
const require = createRequire(
  pathToFileURL(resolvePath(ROOT, "packages", "sdk", "package.json")),
);

const { parse, compileScript } = require("@vue/compiler-sfc");
const typescript = require("typescript");

function compileVueFile(filename) {
  const source = readFileSync(filename, "utf8");
  const { descriptor, errors } = parse(source, { filename });

  if (errors.length > 0) {
    const message = errors
      .map((error) => error.message ?? String(error))
      .join("\n");
    throw new Error(`Failed to parse ${filename}:\n${message}`);
  }

  const id = createHash("sha256").update(filename).digest("hex").slice(0, 8);

  const script = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: {
      compilerOptions: {
        mode: "module",
      },
    },
  });

  const { outputText, diagnostics } = typescript.transpileModule(script.content, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      target: typescript.ScriptTarget.ESNext,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.Bundler,
      useDefineForClassFields: true,
      verbatimModuleSyntax: false,
    },
  });

  if (diagnostics && diagnostics.length > 0) {
    const message = diagnostics
      .map((diagnostic) =>
        typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      )
      .join("\n");
    throw new Error(`Failed to compile ${filename}:\n${message}`);
  }

  return outputText;
}

export const sfcHooks = {
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      const parent = context.parentURL ?? pathToFileURL(`${ROOT}/`).href;
      return {
        url: new URL(specifier, parent).href,
        format: "module",
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.endsWith(".vue")) {
      return {
        format: "module",
        source: compileVueFile(fileURLToPath(url)),
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
};
