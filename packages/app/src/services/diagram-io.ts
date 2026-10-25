import { exportDiagramJson, importDiagramJson } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";

/** The name of the file a diagram with that title is downloaded as. */
function downloadName(title: string | undefined): string {
  const slug = (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "diagram"}.json`;
}

/**
 * Downloads a text as a file.
 *
 * The application cannot hand the text to the browser any other way: it goes
 * through a Blob and an object URL, and the anchor is only a throwaway
 * element that carries the name of the file.
 */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads the diagram as a JSON file.
 *
 * The name of the file comes from the title of the diagram, so that the file
 * can be found again without opening it.
 */
export function downloadDiagramJson(diagram: Diagram, filename?: string): void {
  const text = exportDiagramJson(diagram, { pretty: true });
  downloadText(text, filename ?? downloadName(diagram.title));
}

/**
 * Downloads a JSON text the editor produced.
 *
 * The name of the file is taken from the title of the diagram, when the text
 * carries one.
 */
export function downloadJsonText(text: string, filename?: string): void {
  downloadText(text, filename ?? nameOfJson(text));
}

/** The name of the file of a JSON text, taken from its title. */
function nameOfJson(text: string): string {
  try {
    const parsed = JSON.parse(text) as { title?: string };
    return downloadName(parsed.title);
  } catch {
    return "diagram.json";
  }
}

/**
 * Reads a diagram out of a file the user picked.
 *
 * The promise rejects with the `ImportError` of the core package, which
 * carries the diagnostics of the parser.
 */
export async function readDiagramJsonFile(file: File): Promise<Diagram> {
  const source = await file.text();
  return importDiagramJson(source);
}
