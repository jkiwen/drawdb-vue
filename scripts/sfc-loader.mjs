import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The compiler lives in the SDK package, so the lookup has to start there.
const require = createRequire(pathToFileURL(path.join(ROOT, "packages", "sdk", "package.json")));

const { parse, compileScript, compileTemplate } = require("@vue/compiler-sfc");
const typescript = require("typescript");

/**
 * The components of the workspace come in two shapes:
 *
 * - a `<script setup>` with a `<template>` block, the shape of every component
 *   that was written by hand;
 * - a plain script that exports an options API component and keeps its markup
 *   in a `template` option of the component.
 *
 * The parser of the compiler only reads the blocks of the file, so a markup
 * that lives in the script is masked before it runs, and the template of the
 * component is read from the source afterwards.
 */

/**
 * The expressions of a template are written in the language of the script of
 * the component, so a `<script setup lang="ts">` puts TypeScript in the
 * template: a cast like `($event.target as HTMLInputElement).value` or a non
 * null assertion like `tableById(id)!`. The compiler of the template does not
 * know the language of the script and emits them as they are, so the render
 * function has to go through the transpiler of the script afterwards.
 */
function transpileRender(code, filename) {
  const { outputText } = typescript.transpileModule(code, {
    fileName: filename,
    compilerOptions: {
      target: typescript.ScriptTarget.ESNext,
      module: typescript.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
    },
  });

  return outputText;
}

function compileVueFile(filename) {
  const source = readFileSync(filename, "utf8");
  const masked = source.replace(/template: `[\s\S]*?`,/g, (match) => " ".repeat(match.length));
  const { descriptor, errors } = parse(masked, { filename });

  if (errors.length > 0) {
    const message = errors.map((error) => error.message ?? String(error)).join("\n");
    throw new Error(`Failed to parse ${filename}:\n${message}`);
  }

  const id = createHash("sha256").update(filename).digest("hex").slice(0, 8);
  const hasTemplateBlock = descriptor.template !== undefined && descriptor.template !== null;

  const script = compileScript(descriptor, {
    id,
    // The template of the component is compiled below and attached to the
    // component afterwards.
    inlineTemplate: false,
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

  // The markup of a component that keeps it in a `template` option: the last
  // property of the component, so a nested literal cannot be mistaken for it.
  const templateOption = /template:\s*`([\s\S]*)`,\s*\n\s*\};\s*$/.exec(source);
  const templateSource = hasTemplateBlock
    ? descriptor.template.content
    : templateOption?.[1];

  if (!templateSource) {
    return outputText;
  }

  const templateModule = compileTemplate({
    source: templateSource,
    filename,
    id,
    scoped: descriptor.styles.some((style) => style.scoped),
    compilerOptions: { mode: "module" },
  });

  if (templateModule.errors && templateModule.errors.length > 0) {
    const message = templateModule.errors
      .map((error) => error.message ?? String(error))
      .join("\n");
    throw new Error(`Failed to compile the template of ${filename}:\n${message}`);
  }

  // The script of a `<script setup>` returns the bindings of the setup under
  // the name the template of the component imports them with, and the render
  // function of the template reads them through the proxy of the instance.
  //
  // The setup of a `<script setup>` marks the returned bindings with
  // `__isScriptSetup`. With that flag the runtime only resolves a binding
  // through `accessCache[key] === SETUP`, which is never prefilled in a
  // runtime-only (non-bundler) load, and it skips copying the bindings onto
  // `ctx`. Removing the flag lets the runtime take the
  // `exposeSetupStateOnRenderContext` path, so every binding is reachable
  // from `_ctx`.
  const body = outputText.replace(/export default /, "const __VUE_OPTIONS__ = ");
  const patchedBody = body.replace(
    /Object\.defineProperty\(__returned__, '__isScriptSetup', \{ enumerable: false, value: true \}\);/,
    "",
  );
  const renderBody = transpileRender(
    templateModule.code
      .replace(/import \{ setup as __VUE_SETUP_FN__ \} from ["'][^"']+["'];?\n?/, "")
      .replace(/export function render/, "function render"),
    filename,
  );

  // The imported child components have to be registered on the component the
  // template resolves them from: the render function of a template that uses
  // `<ViewEditor />` looks the name up in `components` of the instance type.
  // An import is matched by the word in front of the keyword, so a named
  // import is captured whole and dropped afterwards — only the identifiers
  // that can be a component survive.
  const importMatches = script.content.matchAll(
    /^import\s+(?:\{[^}]*\}|([\w$]+))\s+from/gm,
  );
  const importedComponents = [...importMatches]
    .map((match) => match[1])
    .filter((name) => name !== undefined);
  const componentsCode =
    importedComponents.length > 0
      ? `\n__VUE_COMPONENT__.components = { ${importedComponents.join(", ")} };`
      : "";

  return `${patchedBody}
${renderBody}
const __VUE_COMPONENT__ = Object.assign({}, __VUE_OPTIONS__, { render });${componentsCode}
export default __VUE_COMPONENT__;
`;
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

    if (url.endsWith(".css")) {
      // Node cannot parse a stylesheet. The styles of the canvas are only
      // needed by a browser, and the specifications of the workspace check
      // the structure of the components, not their look, so the stylesheet is
      // replaced by an empty module.
      return {
        format: "module",
        source: "export default {};\n",
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
};

export { compileVueFile };
