import { computed, type ComputedRef } from "vue";
import { MAX_ZOOM, MIN_ZOOM, useUIStore, ZOOM_STEP } from "../stores/ui.ts";
import { resolvePinia } from "./pinia.ts";

export { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP };

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

export interface ViewportApi {
  zoom: ComputedRef<number>;
  scrollX: ComputedRef<number>;
  scrollY: ComputedRef<number>;
  setZoom(value: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  pan(deltaX: number, deltaY: number): void;
  toCanvasPoint(clientX: number, clientY: number, rect: Rect): Point;
  toScreenPoint(x: number, y: number): Point;
}

/**
 * Viewport state of the canvas.
 *
 * The transform is `screen = (canvas - scroll) * zoom`, which is the
 * transformation the canvas component applies to its content group.
 */
export function useViewport(): ViewportApi {
  const pinia = resolvePinia();
  const ui = useUIStore(pinia);

  const zoom = computed<number>(() => ui.zoom);
  const scrollX = computed<number>(() => ui.scrollX);
  const scrollY = computed<number>(() => ui.scrollY);

  function setZoom(value: number): void {
    ui.setZoom(value);
  }

  function zoomIn(): void {
    ui.zoomIn();
  }

  function zoomOut(): void {
    ui.zoomOut();
  }

  function resetView(): void {
    ui.resetView();
  }

  function pan(deltaX: number, deltaY: number): void {
    ui.scrollX = ui.scrollX + deltaX;
    ui.scrollY = ui.scrollY + deltaY;
  }

  function toCanvasPoint(clientX: number, clientY: number, rect: Rect): Point {
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: screenX / zoom.value + scrollX.value,
      y: screenY / zoom.value + scrollY.value,
    };
  }

  function toScreenPoint(x: number, y: number): Point {
    return {
      x: (x - scrollX.value) * zoom.value,
      y: (y - scrollY.value) * zoom.value,
    };
  }

  return {
    zoom,
    scrollX,
    scrollY,
    setZoom,
    zoomIn,
    zoomOut,
    resetView,
    pan,
    toCanvasPoint,
    toScreenPoint,
  };
}
