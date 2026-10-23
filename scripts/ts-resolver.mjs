/**
 * Node module resolve hook for the workspace test runner.
 *
 * The sandboxed environment cannot build the workspace packages, so the SDK
 * package would otherwise have to import a stale `dist/` bundle of
 * `@drawdb/core`. Node refuses to strip TypeScript types for files that live
 * under `node_modules`, which rules out the plain workspace symlink.
 *
 * This hook remaps the `@drawdb/core` specifier to the package source, which
 * lives outside `node_modules` and can therefore be type stripped.
 */
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolvePath(import.meta.dirname, "..");
const CORE_SOURCE = pathToFileURL(
  resolvePath(ROOT, "packages", "core", "src", "index.ts"),
).href;

export const hooks = {
  resolve(specifier, context, nextResolve) {
    if (specifier === "@drawdb/core") {
      return {
        url: CORE_SOURCE,
        format: "module-typescript",
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
};
