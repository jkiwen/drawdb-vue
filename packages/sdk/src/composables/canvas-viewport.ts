/**
 * The size of the canvas, as the layout measured it.
 *
 * The viewport is measured by the canvas itself (a `ResizeObserver` on the
 * element that holds the diagram) and kept here so that the outline, the
 * toolbar and the zoom actions can turn a point of the diagram into the
 * centre of what the reader sees.
 *
 * Two callers may ask for the size in a row while the layout is still
 * settling (a panel opens, a dialog closes); a measurement taken on demand
 * keeps them consistent, so a new element lands exactly where the next
 * centring expects it and repeated adds do not drift.
 */
import { ref } from "vue";

export interface CanvasViewportSize {
  width: number;
  height: number;
}

const viewport = ref<CanvasViewportSize>({ width: 0, height: 0 });

let measurer: (() => CanvasViewportSize | null) | null = null;

/** Records the size the canvas last measured. */
export function setViewportSize(size: CanvasViewportSize): void {
  viewport.value = size;
}

/**
 * Lets the canvas hand in a measurement it can repeat on demand. The canvas
 * registers it while it is mounted and clears it when it goes away.
 */
export function setViewportMeasurer(
  next: (() => CanvasViewportSize | null) | null,
): void {
  measurer = next;
}

/** The size of the canvas right now, measured again when it is possible. */
export function measureViewport(): CanvasViewportSize {
  const measured = measurer?.();
  if (measured && measured.width > 0 && measured.height > 0) {
    viewport.value = measured;
  }
  return viewport.value;
}

/** The shared viewport of the canvas. */
export function useCanvasViewport() {
  return { viewport, setViewportSize, measureViewport };
}
