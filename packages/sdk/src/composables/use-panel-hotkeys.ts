import { useSettingsStore } from "../stores/settings.ts";
import { useHotkeys } from "./use-hotkeys.ts";
import type { HotkeyEvent } from "./use-hotkeys.ts";

/**
 * The hotkeys of the layout panels (plan Task 1 item 3): mod+b toggles the
 * left panel, mod+alt+b the right one and mod+` the bottom one. The collapse
 * state lives in the settings store, so the preference survives a reload
 * (ruling Q5).
 *
 * Returns a stop handle that detaches the listener and unregisters the
 * bindings, so the host of the editor can give the shortcuts up.
 */
export function usePanelHotkeys(): () => void {
  const settings = useSettingsStore();
  const hotkeys = useHotkeys();

  function toggle(key: "panelLeftCollapsed" | "panelRightCollapsed" | "panelBottomCollapsed") {
    return (event: HotkeyEvent): void => {
      event.preventDefault?.();
      settings.update({ [key]: !settings.settings[key] });
    };
  }

  hotkeys.register("mod+b", toggle("panelLeftCollapsed"), {
    description: "Toggle the left panel",
  });
  hotkeys.register("mod+alt+b", toggle("panelRightCollapsed"), {
    description: "Toggle the right panel",
  });
  hotkeys.register("mod+`", toggle("panelBottomCollapsed"), {
    description: "Toggle the bottom panel",
  });

  const listener = (event: KeyboardEvent): void => {
    hotkeys.handle(event);
  };
  window.addEventListener("keydown", listener);

  return () => {
    window.removeEventListener("keydown", listener);
    hotkeys.unregister("mod+b");
    hotkeys.unregister("mod+alt+b");
    hotkeys.unregister("mod+`");
  };
}
