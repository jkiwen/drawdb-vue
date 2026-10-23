import { toPng } from "html-to-image";

/** Thrown when the capture of the canvas fails. */
export class ImageExportError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ImageExportError";
    this.cause = cause;
  }
}

export interface ImageExportOptions {
  /** How much larger than the on screen size the image is. */
  pixelRatio?: number;
  /** The colour the empty areas of the image are filled with. */
  backgroundColor?: string;
}

/**
 * The indirection the tests replace: the capture itself is a browser API the
 * sandbox cannot run, so the module keeps it behind `captureState.capture`.
 */
export const captureState = {
  capture: (element: HTMLElement, options?: ImageExportOptions) =>
    toPng(element, {
      pixelRatio: options?.pixelRatio,
      backgroundColor: options?.backgroundColor,
    }),
};

/**
 * Renders the element as a PNG data URL.
 *
 * While the capture runs the element carries a `data-exporting` attribute so
 * that the styles of the editor can hide the interaction layer. The marker is
 * removed when the capture settles, whether it worked or not.
 */
export async function exportPng(
  element: HTMLElement,
  options?: ImageExportOptions,
): Promise<string> {
  element.setAttribute("data-exporting", "true");
  try {
    return await captureState.capture(element, options);
  } catch (error) {
    throw new ImageExportError("The image could not be rendered", error);
  } finally {
    element.removeAttribute("data-exporting");
  }
}
