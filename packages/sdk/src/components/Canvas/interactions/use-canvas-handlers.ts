import { computed, type ComputedRef, type Ref } from "vue";
import { useDiagramStore } from "../../../stores/diagram.ts";
import { useUIStore } from "../../../stores/ui.ts";
import {
  type CanvasEventHandlers,
} from "../../../composables/use-canvas-events.ts";
import { useCanvasInteractions } from "../../../composables/use-canvas-interactions.ts";
import { useDrag } from "../../../composables/use-drag.ts";
import { useSelection } from "../../../composables/use-selection.ts";
import { useViewport } from "../../../composables/use-viewport.ts";
import { useCanvasActions } from "./use-canvas-actions.ts";
import { useCanvasCommands } from "./use-canvas-commands.ts";
import { useCanvasDrag } from "./use-canvas-drag.ts";
import { rectBetween, type SelectionRect } from "./use-selection-box.ts";
import type { ResizeApi } from "./use-resize.ts";
import type { CanvasContextMenuState } from "./use-context-menu.ts";
import {
  fieldAnchor,
  relationshipPath,
  type GeometryPoint,
} from "../geometry.ts";

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasHandlersOptions {
  /** The size of the grid the tables snap to while they are dragged. */
  gridSize: () => number;
  /** The rectangle of the canvas, in the coordinates of the screen. */
  rect: () => CanvasRect;
}

/**
 * The corner of a table, of an area or of a note that the user grabbed.
 *
 * The components of the canvas emit the id of the element they hold, so the
 * handler tells them apart by the field that carries it.
 */
export interface ResizeStartPayload {
  /** The table of the handle, when the corner belongs to a table. */
  tableId?: string;
  /** The area of the handle, when the corner belongs to an area. */
  areaId?: string | number;
  /** The note of the handle, when the corner belongs to a note. */
  noteId?: string | number;
  width: number;
  height: number;
  event: PointerEvent;
}

export interface CanvasHandlersApi {
  selection: ReturnType<typeof useSelection>;
  /**
   * The resize that runs while the user drags a corner, so that the component
   * of the element that is resized can draw the size of the drag before the
   * release stores it.
   */
  resize: ResizeApi;
  handlers: CanvasEventHandlers;
  linkPath: ComputedRef<string>;
  selectionRect: ComputedRef<SelectionRect | null>;
  menu: Ref<CanvasContextMenuState | null>;
  /** Closes the menu of the right button. */
  closeMenu(): void;
  onTableDragStart(payload: { id: string; event: PointerEvent }): void;
  onAreaDragStart(payload: {
    areaId: string | number;
    event: PointerEvent;
  }): void;
  onNoteDragStart(payload: {
    noteId: string | number;
    event: PointerEvent;
  }): void;
  onFieldSelect(payload: {
    tableId: string;
    fieldId: string;
    event: PointerEvent;
  }): void;
  onLinkStart(payload: {
    tableId: string;
    fieldId: string;
    event: PointerEvent;
  }): void;
  onResizeStart(payload: ResizeStartPayload): void;
  runMenuCommand(key: string): boolean;
}

/**
 * The pointer handling of the canvas.
 *
 * The composable owns the interactions of the canvas — the drag of a table, the
 * link that the user draws, the rectangle that selects several tables, the
 * selection and the resize of an area and the menu of the right button — so
 * that the component of the canvas only has to draw the result.
 */
export function useCanvasHandlers(
  options: CanvasHandlersOptions,
): CanvasHandlersApi {
  const diagram = useDiagramStore();
  const ui = useUIStore();
  const selection = useSelection();
  const drag = useDrag();
  const viewport = useViewport();
  const commands = useCanvasCommands();
  const { linking, selectionBox, resize, contextMenu } = useCanvasInteractions();

  const actions = useCanvasActions({
    diagram,
    selection,
    drag,
    selectionBox,
    resize,
    linking,
    contextMenu,
    commands,
  });

  const elementDrag = useCanvasDrag({
    diagram,
    selection,
    drag,
    actions,
    point: canvasPoint,
    gridSize: options.gridSize,
    snapToGrid: () => ui.snapToGrid,
  });

  let panOrigin: GeometryPoint | null = null;
  let panScroll: GeometryPoint | null = null;
  let lastPointer: GeometryPoint | null = null;

  function canvasPoint(event: { clientX: number; clientY: number }) {
    return viewport.toCanvasPoint(event.clientX, event.clientY, options.rect());
  }

  /** The line that follows the pointer while a relationship is drawn. */
  const linkPath = computed(() => {
    const state = linking.linking.value;
    if (!state) {
      return "";
    }
    const table = diagram.tableById(state.sourceTableId);
    if (!table) {
      return "";
    }
    const side = state.pointer.x >= table.x ? "right" : "left";
    return relationshipPath(
      fieldAnchor(table, state.sourceFieldId, side),
      state.pointer,
    );
  });

  /** The rectangle that selects the tables it touches. */
  const selectionRect = computed(() => {
    const box = selectionBox.box.value;
    if (!box.active) {
      return null;
    }
    return rectBetween(box.origin, box.current);
  });

  function onFieldSelect(payload: {
    tableId: string;
    fieldId: string;
    event: PointerEvent;
  }): void {
    ui.selectField(payload.tableId, payload.fieldId, payload.event.shiftKey);
  }

  function onLinkStart(payload: {
    tableId: string;
    fieldId: string;
    event: PointerEvent;
  }): void {
    linking.start(payload.tableId, payload.fieldId, canvasPoint(payload.event));
  }

  function onResizeStart(payload: ResizeStartPayload): void {
    const id = payload.noteId ?? payload.areaId ?? payload.tableId;
    if (id === undefined) {
      return;
    }
    const kind =
      payload.noteId !== undefined
        ? "note"
        : payload.areaId !== undefined
          ? "area"
          : "table";
    resize.begin({
      kind,
      id,
      width: payload.width,
      height: payload.height,
    });
    lastPointer = { x: payload.event.clientX, y: payload.event.clientY };
  }

  const handlers: CanvasEventHandlers = {
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }
      if (event.shiftKey) {
        selectionBox.begin(canvasPoint(event));
        return;
      }
      selection.clear();
      panOrigin = { x: event.clientX, y: event.clientY };
      panScroll = { x: ui.scrollX, y: ui.scrollY };
    },
    onPointerMove(event: PointerEvent) {
      const point = canvasPoint(event);
      if (linking.linking.value) {
        linking.move(point);
        return;
      }
      if (resize.resizing.value && lastPointer) {
        resize.move(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
        lastPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      if (selectionBox.box.value.active) {
        selectionBox.move(point);
        return;
      }
      if (drag.dragState.active) {
        drag.updateDrag(point);
        elementDrag.preview();
        return;
      }
      if (panOrigin && panScroll) {
        const zoom = viewport.zoom.value;
        ui.scrollX = panScroll.x - (event.clientX - panOrigin.x) / zoom;
        ui.scrollY = panScroll.y - (event.clientY - panOrigin.y) / zoom;
      }
    },
    onPointerUp(event: PointerEvent) {
      if (linking.linking.value) {
        actions.commitLink(event);
      } else if (selectionBox.box.value.active) {
        actions.commitSelection(selectionRect.value);
      } else if (resize.resizing.value) {
        actions.commitResize();
      } else if (drag.dragState.active) {
        elementDrag.commit();
      }
      panOrigin = null;
      panScroll = null;
      lastPointer = null;
    },
    onPointerCancel() {
      elementDrag.cancel();
      // A cancelled resize keeps the size it had before the pointer was
      // pressed; it is not committed.
      resize.end();
      panOrigin = null;
      panScroll = null;
      lastPointer = null;
    },
    onWheel(event: WheelEvent) {
      ui.setZoom(ui.zoom - event.deltaY * 0.001);
    },
    onContextMenu(event: MouseEvent) {
      event.preventDefault();
      contextMenu.open(
        event.clientX,
        event.clientY,
        actions.contextTargetOf(event),
      );
    },
  };

  return {
    selection,
    resize,
    handlers,
    linkPath,
    selectionRect,
    menu: contextMenu.menu,
    closeMenu: contextMenu.close,
    onTableDragStart: elementDrag.onTableDragStart,
    onAreaDragStart: elementDrag.onAreaDragStart,
    onNoteDragStart: elementDrag.onNoteDragStart,
    onFieldSelect,
    onLinkStart,
    onResizeStart,
    runMenuCommand: actions.runMenuCommand,
  };
}
