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
 *
 * The third state, maximized, fills the canvas area while the title bar
 * stays visible (design section 8.2). It is session-only UI state: it is
 * never persisted and does not change the stored height, so restoring the
 * panel returns to the height the user had before.
 */
export function useBottomPanel(): {
  activeTab: import("vue").Ref<BottomPanelTab>;
  collapsed: import("vue").ComputedRef<boolean>;
  maximized: import("vue").Ref<boolean>;
  height: import("vue").ComputedRef<number>;
  setTab: (tab: BottomPanelTab) => void;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  setMaximized: (value: boolean) => void;
  toggleMaximized: () => void;
  startResize: (event: MouseEvent) => void;
  resetHeight: () => void;
} {
  const settings = useSettingsStore();

  const activeTab = ref<BottomPanelTab>("issues");
  const maximized = ref(false);

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
    // The collapsed title bar is the smallest state; maximizing while
    // collapsing would contradict it, so collapsing ends the maximized state.
    if (value) maximized.value = false;
  }

  function toggleCollapsed(): void {
    setCollapsed(!collapsed.value);
  }

  function setMaximized(value: boolean): void {
    maximized.value = value;
    // A maximized panel must show its body, so it always un-collapses; the
    // stored collapsed state is the one the toggle later returns to.
    if (value) settings.update({ panelBottomCollapsed: false });
  }

  function toggleMaximized(): void {
    setMaximized(!maximized.value);
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
    if (collapsed.value || maximized.value) return;
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
    maximized,
    height,
    setTab,
    setCollapsed,
    toggleCollapsed,
    setMaximized,
    toggleMaximized,
    startResize,
    resetHeight,
  };
}
