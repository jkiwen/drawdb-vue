/**
 * A DOM for the workspace test runner.
 *
 * The components of the SDK are built with Naive UI, which mounts its styles
 * into the document and therefore needs a DOM, even when it is rendered on the
 * server. jsdom provides that DOM.
 *
 * The globals are installed before the spec files are imported, so that Vue
 * and Naive UI see them while they are loaded.
 */
import { JSDOM } from "jsdom";

const SKIPPED = new Set([
  "globalThis",
  "global",
  "process",
  "Buffer",
  "require",
  "module",
  "exports",
  "navigator",
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "fetch",
  "crypto",
  "performance",
  "structuredClone",
  "atob",
  "btoa",
]);

export function installDom() {
  const dom = new JSDOM(
    "<!doctype html><html><head></head><body></body></html>",
    { pretendToBeVisual: true, url: "http://localhost/" },
  );

  const target = globalThis;

  // Every property of the window that Node does not already provide is
  // exposed as a global, so that the browser APIs Naive UI relies on
  // (Image, matchMedia, localStorage, ...) exist.
  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (SKIPPED.has(key)) {
      continue;
    }
    let value;
    try {
      value = dom.window[key];
    } catch {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    try {
      Object.defineProperty(target, key, {
        value,
        configurable: true,
        writable: true,
      });
    } catch {
      // A read-only global of Node wins over the DOM one.
    }
  }

  if (typeof target.requestAnimationFrame !== "function") {
    target.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(Date.now()), 16);
  }

  if (typeof target.cancelAnimationFrame !== "function") {
    target.cancelAnimationFrame = (handle) => clearTimeout(handle);
  }
}
