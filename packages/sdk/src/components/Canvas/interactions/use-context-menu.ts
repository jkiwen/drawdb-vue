import { ref, type Ref } from "vue";
import type { ContextMenuTarget } from "./interaction-state.ts";

export type { ContextMenuTarget };

/** The state of the menu of the canvas. */
export interface CanvasContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

export interface ContextMenuApi {
  /** The menu that is open, or `null`. */
  menu: Ref<CanvasContextMenuState | null>;
  /** Opens the menu at a point of the screen. */
  open(x: number, y: number, target: ContextMenuTarget): void;
  /** Closes the menu. */
  close(): void;
}

/**
 * The menu that the user opens with the right button on the canvas. The
 * composable only holds the state; the menu itself is a component of the
 * canvas.
 *
 * The canvas closes the menu through `close()`, and the interaction layer
 * mirrors what it holds into the store of the interface, so a host that hides
 * the canvas still sees whether a menu is open. Closing it from the store
 * alone would leave the menu on the screen (bug report of 2026-10-29): the
 * menu is drawn from this reference.
 */
export function useContextMenu(): ContextMenuApi {
  const menu = ref<CanvasContextMenuState | null>(null);

  function open(x: number, y: number, target: ContextMenuTarget): void {
    menu.value = { x, y, target };
  }

  function close(): void {
    menu.value = null;
  }

  return { menu, open, close };
}
