import { exportDiagramJson, importDiagramJson } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";

/** The name of the file a diagram is downloaded as. */
function downloadName(diagram: Diagram): string {
  const slug = (diagram.title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "diagram"}.json`;
}

/**
 * Downloads the diagram as a JSON file.
 *
 * The application cannot hand the diagram to the browser any other way: the
 * text goes through a Blob and an object URL, and the anchor is only a
 * throwaway element that carries the name of the file.
 */
export function downloadDiagramJson(diagram: Diagram, filename?: string): void {
  const text = exportDiagramJson(diagram, { pretty: true });
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? downloadName(diagram);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
