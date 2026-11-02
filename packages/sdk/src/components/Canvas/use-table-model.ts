import { computed, type ComputedRef } from "vue";
import type { Table } from "@drawdb/core";
import { tableRenderModel, type TableRenderModel } from "./render-model.ts";
import { domainLookup } from "./table-domains.ts";
import { foreignKeyRows } from "./table-sections.ts";
import { foreignKeyRefs } from "./table-foreign-keys.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import { useToolbarScopeStore } from "../../stores/toolbar-scope.ts";
import { useTypeScopeStore } from "../../stores/type-scope.ts";

/**
 * Everything a table node draws, derived from the stores.
 *
 * The node itself only needs the result: the render model behind it is a pure
 * function of the table, the view layer and the toggles, and the inputs it
 * needs — the domains of the three scope layers, the foreign key rows, the
 * marks of the fields a relationship points from — are lookups into the
 * stores. Keeping them here leaves the component at its layout size (the SDK
 * caps every file at 300 lines).
 */
export function useTableModel(liveTable: ComputedRef<Table>): {
  model: ComputedRef<TableRenderModel>;
} {
  const diagram = useDiagramStore();
  const viewState = useViewStateStore();
  const toolbarScope = useToolbarScopeStore();
  const typeScope = useTypeScopeStore();

  // The lookup of a domain, built with the rule of the core: the diagram's
  // own domains are the diagram layer of the scope, the closest layer to the
  // attribute, and a domain is found by its name or by its id.
  const resolveDomain = computed(() =>
    domainLookup(typeScope.getSnapshot(), diagram.diagram),
  );

  /** The ids of the fields a foreign key points from (UI document 6.1). */
  const foreignFieldIds = computed(() => {
    const ids = new Set<string>();
    for (const relationship of diagram.relationships) {
      if (String(relationship.endTableId) === String(liveTable.value.id)) {
        ids.add(String(relationship.endFieldId));
      }
    }
    return ids;
  });

  const foreignKeys = computed(() =>
    foreignKeyRows(liveTable.value, diagram.relationships, diagram.tables),
  );
  const foreignKeyRefsOfTable = computed(() =>
    foreignKeyRefs(liveTable.value, diagram.relationships),
  );

  const model = computed(() =>
    tableRenderModel(liveTable.value, viewState.viewLayer, viewState.toggles, {
      resolveDomain: resolveDomain.value,
      foreignFieldIds: foreignFieldIds.value,
      foreignKeys: foreignKeys.value,
      foreignKeyRefs: foreignKeyRefsOfTable.value,
      // Ruling Q1: a scoped toolbar change overrides the canvas-wide toggles
      // for this table only.
      overrides: toolbarScope.overrideFor(String(liveTable.value.id)),
    }),
  );

  return { model };
}
