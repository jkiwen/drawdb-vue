/**
 * The scope of the toolbar display tools (design 6.0, ruling Q1).
 *
 * The display mode and the per-table view toggles apply to the selection
 * when one exists — the selected tables plus the tables the selected areas
 * hold — and to the whole canvas otherwise. A scoped change is stored as a
 * per-table override here; the canvas passes the overrides to the render
 * model through the `TableRenderOptions.overrides` hook. A change without a
 * selection lands in the view-state store like before.
 */
import { computed } from "vue";
import { defineStore } from "pinia";
import {
  togglesForDisplayMode,
  type Diagram,
  type DisplayMode,
  type ViewStateToggles,
} from "@drawdb/core";
import { areaHolds, elementBounds } from "../utils/elements.ts";
import { useDiagramStore } from "./diagram.ts";
import { useUIStore } from "./ui.ts";
import { useViewStateStore } from "./view-state.ts";

/** The tables a toolbar change applies to: the selection, or none (canvas). */
export function resolveToolbarScope(
  diagram: Diagram,
  selectedTableIds: readonly string[],
  selectedAreaIds: readonly string[],
): string[] {
  if (selectedTableIds.length === 0 && selectedAreaIds.length === 0) {
    return [];
  }

  const ids = new Set(selectedTableIds);
  const areas = diagram.areas ?? diagram.subjectAreas ?? [];
  for (const areaId of selectedAreaIds) {
    // TableId/AreaId are `string | number`; compare and key as strings.
    const area = areas.find((candidate) => String(candidate.id) === areaId);
    if (!area) continue;
    for (const table of diagram.tables) {
      if (areaHolds(area, elementBounds(table))) {
        ids.add(String(table.id));
      }
    }
  }
  return [...ids];
}

export type ToolbarScopeKind = "canvas" | "tables";

export const useToolbarScopeStore = defineStore("toolbar-scope", () => {
  const diagramStore = useDiagramStore();
  const ui = useUIStore();
  const viewState = useViewStateStore();

  /**
   * The per-table overrides of the view toggles, keyed by table id. They live
   * in the view state of the document (ruling Q2), so a reload keeps them.
   */
  const overrides = computed<Record<string, Partial<ViewStateToggles>>>(
    () => diagramStore.diagram.viewState?.overrides ?? {},
  );

  const scopeTableIds = computed(() =>
    resolveToolbarScope(
      diagramStore.diagram,
      ui.selectedTableIds,
      ui.selectedAreaIds,
    ),
  );

  /** The selection scopes the tools even when it holds no table yet. */
  const hasScopeSelection = computed(
    () => ui.selectedTableIds.length > 0 || ui.selectedAreaIds.length > 0,
  );

  const scopeKind = computed<ToolbarScopeKind>(() =>
    hasScopeSelection.value ? "tables" : "canvas",
  );
  const scopeCount = computed(() => scopeTableIds.value.length);

  function writeScoped(partial: Partial<ViewStateToggles>): void {
    const next: Record<string, Partial<ViewStateToggles>> = {
      ...overrides.value,
    };
    for (const id of scopeTableIds.value) {
      next[id] = { ...next[id], ...partial };
    }
    diagramStore.updateViewState({ overrides: next });
  }

  /**
   * A change of the canvas has to reach every table (issue 2), so it also
   * drops the overrides a scoped change left behind — otherwise the tables
   * the user collapsed one by one would keep their own toggles.
   */
  function clearOverridesForCanvas(): void {
    if (Object.keys(overrides.value).length > 0) {
      resetOverrides();
    }
  }

  function setScopedToggle(
    key: keyof ViewStateToggles,
    value: boolean,
  ): void {
    if (scopeKind.value === "canvas") {
      viewState.setToggle(key, value);
      clearOverridesForCanvas();
      return;
    }
    writeScoped({ [key]: value });
  }

  function setScopedDisplayMode(mode: Exclude<DisplayMode, "custom">): void {
    if (scopeKind.value === "canvas") {
      viewState.setDisplayMode(mode);
      clearOverridesForCanvas();
      return;
    }
    writeScoped({ ...togglesForDisplayMode(mode) });
  }

  function overrideFor(
    tableId: string,
  ): Partial<ViewStateToggles> | undefined {
    return overrides.value[tableId];
  }

  function resetOverrides(): void {
    diagramStore.updateViewState({ overrides: {} });
  }

  return {
    overrides,
    scopeTableIds,
    scopeKind,
    scopeCount,
    setScopedToggle,
    setScopedDisplayMode,
    overrideFor,
    resetOverrides,
  };
});

export type ToolbarScopeStore = ReturnType<typeof useToolbarScopeStore>;
