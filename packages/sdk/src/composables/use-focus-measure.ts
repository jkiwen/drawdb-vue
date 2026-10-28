import type { Table } from "@drawdb/core";
import { tableRenderModel } from "../components/Canvas/render-model.ts";
import { useViewStateStore } from "../stores/view-state.ts";
import type { FocusSize } from "../stores/selection-actions.ts";

/**
 * The drawn size of a table, for the code that centres a node in the canvas.
 *
 * The size depends on the layer and on the display toggles (a collapsed
 * table is only its header), so it is measured with the same render model the
 * canvas draws with instead of a constant.
 */
export function useTableFocusSize(): (table: Table) => FocusSize {
  const viewState = useViewStateStore();
  return (table: Table): FocusSize => {
    const model = tableRenderModel(table, viewState.viewLayer, viewState.toggles);
    return { width: model.width, height: model.height };
  };
}
