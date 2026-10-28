import { ref } from "vue";
import type { ViewportSize } from "./zoom-actions.ts";

/**
 * The size of the visible canvas, in screen pixels.
 *
 * The canvas measures itself and writes the size here; the store that moves
 * the viewport (centring an object the outline points at) reads it. It is
 * module level because the canvas is the only component that knows the size
 * and every reader wants the same one.
 */
const viewport = ref<ViewportSize>({ width: 0, height: 0 });

/** Records the size of the visible canvas. */
export function setViewportSize(size: ViewportSize): void {
  viewport.value = size;
}

/** The size of the visible canvas, as the canvas last measured it. */
export function useCanvasViewport(): {
  viewport: typeof viewport;
  setViewportSize: typeof setViewportSize;
} {
  return { viewport, setViewportSize };
}
