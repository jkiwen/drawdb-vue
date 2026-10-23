import { watch } from "vue";
import { useUIStore } from "../stores/ui.ts";
import { useContextMenu } from "../components/Canvas/interactions/use-context-menu.ts";
import { useLinking } from "../components/Canvas/interactions/use-linking.ts";
import { useResize } from "../components/Canvas/interactions/use-resize.ts";
import { useSelectionBox } from "../components/Canvas/interactions/use-selection-box.ts";

export interface CanvasInteractions {
  linking: ReturnType<typeof useLinking>;
  selectionBox: ReturnType<typeof useSelectionBox>;
  resize: ReturnType<typeof useResize>;
  contextMenu: ReturnType<typeof useContextMenu>;
}

/**
 * The interactions of the canvas: the link that the user draws, the rectangle
 * that selects several tables, the resize of a table and the menu of the right
 * button.
 *
 * The composables hold the behaviour, the store of the interface holds the
 * state, so that a host application can react to it.
 */
export function useCanvasInteractions(): CanvasInteractions {
  const ui = useUIStore();

  const linking = useLinking();
  const selectionBox = useSelectionBox();
  const resize = useResize();
  const contextMenu = useContextMenu();

  watch(
    linking.linking,
    (value) => {
      ui.linking = value;
    },
    { deep: true },
  );

  watch(
    selectionBox.box,
    (value) => {
      ui.selectionBox = value.active ? value : null;
    },
    { deep: true },
  );

  watch(resize.resizing, (value) => {
    ui.resizing = value;
  });

  watch(contextMenu.menu, (value) => {
    if (!value) {
      ui.closeContextMenu();
      return;
    }
    const target = value.target;
    if (target.kind === "table") {
      ui.openContextMenu({
        x: value.x,
        y: value.y,
        target: { kind: "table", id: String(target.tableId) },
      });
      return;
    }
    if (target.kind === "field") {
      ui.openContextMenu({
        x: value.x,
        y: value.y,
        target: {
          kind: "field",
          tableId: String(target.tableId),
          fieldId: String(target.fieldId),
        },
      });
      return;
    }
    ui.openContextMenu({ x: value.x, y: value.y, target: { kind: "canvas" } });
  });

  return { linking, selectionBox, resize, contextMenu };
}
