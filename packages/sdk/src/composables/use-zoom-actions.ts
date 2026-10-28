/**
 * The zoom of the canvas as the toolbar drives it (design 6.6): the percent
 * field, "fit the diagram" and "zoom to the selection".
 *
 * The zoom and the scroll live in the ui store; this composable only reads
 * the diagram to measure the content and the canvas to know the viewport.
 * The viewport is set once by the canvas and is module level, because the
 * canvas is the only component that knows the visible size.
 */
import { ref } from "vue";
import { useDiagramStore } from "../stores/diagram.ts";
import { MAX_ZOOM, MIN_ZOOM, useUIStore } from "../stores/ui.ts";
import {
  contentBounds,
  fitScroll,
  fitZoom,
  type ViewportSize,
} from "./zoom-actions.ts";

/** The visible canvas, in screen pixels; set by the canvas component. */
const viewport = ref<ViewportSize>({ width: 0, height: 0 });

export function useZoomActions() {
  const ui = useUIStore();
  const diagram = useDiagramStore();

  /** Records the visible size of the canvas (called on mount and resize). */
  function setViewport(size: ViewportSize): void {
    viewport.value = size;
  }

  /** Fits the whole diagram into the canvas. */
  function fitToContent(): boolean {
    const tables = diagram.diagram.tables;
    const box = contentBounds(tables);
    if (box === null) {
      return false;
    }
    const zoom = fitZoom(box, viewport.value);
    const scroll = fitScroll(box, viewport.value, zoom);
    ui.setZoom(zoom);
    ui.scrollX = scroll.scrollX;
    ui.scrollY = scroll.scrollY;
    return true;
  }

  /** Fits the selected tables into the canvas. */
  function fitToSelection(): boolean {
    const selected = new Set(ui.selectedTableIds);
    const tables = diagram.diagram.tables.filter((table) =>
      selected.has(String(table.id)),
    );
    const box = contentBounds(tables);
    if (box === null) {
      return false;
    }
    const zoom = fitZoom(box, viewport.value);
    const scroll = fitScroll(box, viewport.value, zoom);
    ui.setZoom(zoom);
    ui.scrollX = scroll.scrollX;
    ui.scrollY = scroll.scrollY;
    return true;
  }

  /** Applies a percentage typed into the field, inside the zoom bounds. */
  function zoomToPercent(percent: number): void {
    if (!Number.isFinite(percent)) {
      return;
    }
    ui.setZoom(percent / 100);
  }

  return {
    viewport,
    zoom: () => ui.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    setViewport,
    fitToContent,
    fitToSelection,
    zoomToPercent,
  };
}
