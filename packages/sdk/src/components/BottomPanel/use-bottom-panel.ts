import { computed, ref } from "vue";
import {
  PANEL_BOTTOM_DEFAULT_HEIGHT,
  PANEL_BOTTOM_MAX_HEIGHT,
  PANEL_BOTTOM_MIN_HEIGHT,
  useSettingsStore,
} from "../../stores/settings.ts";

/** The tabs of the bottom panel (design section 8.1). */
export type BottomPanelTab = "issues" | "log" | "history" | "trace";

/**
 * The interaction state of the bottom panel.
 *
 * The panel is the vertical sibling of the resizable side panels: the user
 * drags its top edge to grow it, a double click on the edge restores the
 * default height and the chevron collapses it to its 28px title bar. The
 * height and the collapsed state live in the settings store so they survive
 * a reload (ruling Q5); the active tab is ephemeral view state.
 */
export function useBottomPanel(): {
  activeTab: import("vue").Ref<BottomPanelTab>;
  collapsed: import("vue").ComputedRef<boolean>;
  height: import("vue").ComputedRef<number>;
  setTab: (tab: BottomPanelTab) => void;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  startResize: (event: MouseEvent) => void;
  resetHeight: () => void;
} {
  const settings = useSettingsStore();

  const activeTab = ref<BottomPanelTab>("issues");

  const collapsed = computed(
    () => settings.settings.panelBottomCollapsed ?? false,
  );
  const height = computed(
    () => settings.settings.panelBottomHeight ?? PANEL_BOTTOM_DEFAULT_HEIGHT,
  );

  function setTab(tab: BottomPanelTab): void {
    activeTab.value = tab;
  }

  function setCollapsed(value: boolean): void {
    settings.update({ panelBottomCollapsed: value });
  }

  function toggleCollapsed(): void {
    setCollapsed(!collapsed.value);
  }

  /** Clamps a height to the bounds of the panel. */
  function clampHeight(value: number): number {
    return Math.min(
      PANEL_BOTTOM_MAX_HEIGHT,
      Math.max(PANEL_BOTTOM_MIN_HEIGHT, Math.round(value)),
    );
  }

  /** Starts a drag of the top edge and follows the mouse until it is up. */
  function startResize(event: MouseEvent): void {
    if (collapsed.value) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height.value;

    function onMove(move: MouseEvent): void {
      // Dragging up grows the panel; the height is persisted on every move.
      settings.update({
        panelBottomHeight: clampHeight(startHeight + (startY - move.clientY)),
      });
    }

    function onUp(): void {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /** Restores the default height of the panel. */
  function resetHeight(): void {
    settings.update({ panelBottomHeight: PANEL_BOTTOM_DEFAULT_HEIGHT });
  }

  return {
    activeTab,
    collapsed,
    height,
    setTab,
    setCollapsed,
    toggleCollapsed,
    startResize,
    resetHeight,
  };
}
