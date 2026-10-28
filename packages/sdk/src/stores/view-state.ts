import { defineStore } from "pinia";
import { computed } from "vue";
import {
  createDefaultViewState,
  displayModeForToggles,
  togglesForDisplayMode,
} from "@drawdb/core";
import type {
  DisplayMode,
  ViewLayer,
  ViewStateToggles,
} from "@drawdb/core";
import { useDiagramStore } from "./diagram.ts";

/**
 * The view state of the editor: which layer and which display mode the
 * canvas and the outline tree render (UI document sections 6.1, 6.4, 9.2).
 *
 * The state lives in the diagram document — it is saved with the diagram and
 * restored on load (ruling Q2) — but it never enters the undo stack: undoing
 * an edit must not change how the user looks at the diagram. The zoom stays
 * in the UI store; it is session state and is never persisted.
 */
export const useViewStateStore = defineStore("view-state", () => {
  const diagramStore = useDiagramStore();

  const viewState = computed(
    () => diagramStore.diagram.viewState ?? createDefaultViewState(),
  );
  const viewLayer = computed(() => viewState.value.viewLayer);
  const displayMode = computed(() => viewState.value.displayMode);
  const toggles = computed(() => viewState.value.toggles);

  function setViewLayer(layer: ViewLayer): void {
    diagramStore.updateViewState({ viewLayer: layer });
  }

  /**
   * Applies a display mode. The four modes are presets of the per-item
   * toggles; "custom" is never set directly — it is derived from a manual
   * toggle combination that matches no preset (ruling Q20).
   */
  function setDisplayMode(mode: DisplayMode): void {
    if (mode === "custom") return;
    diagramStore.updateViewState({
      displayMode: mode,
      toggles: togglesForDisplayMode(mode),
    });
  }

  /**
   * Flips one per-item toggle. The display mode is re-derived: a combination
   * matching a preset shows that preset again, anything else is "custom".
   */
  function setToggle(key: keyof ViewStateToggles, value: boolean): void {
    const nextToggles = { ...toggles.value, [key]: value };
    diagramStore.updateViewState({
      toggles: nextToggles,
      displayMode: displayModeForToggles(nextToggles),
    });
  }

  return {
    viewState,
    viewLayer,
    displayMode,
    toggles,
    setViewLayer,
    setDisplayMode,
    setToggle,
  };
});
