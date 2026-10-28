import { createDefaultViewState } from "@drawdb/core";
import type { Diagram, ViewState } from "@drawdb/core";

/**
 * The view-state actions of the diagram store, kept apart so the store file
 * stays within the 300 line budget.
 */
export function viewStateActions(diagram: Diagram, bump: () => void) {
  /**
   * Changes the view state of the diagram (UI document section 9.2, ruling
   * Q2): the change is part of the document and is saved with it, but it is
   * deliberately not recorded in the undo history — undoing an edit must not
   * change how the user looks at the diagram.
   */
  function updateViewState(updates: Partial<ViewState>): void {
    const current = diagram.viewState ?? createDefaultViewState();
    diagram.viewState = {
      ...current,
      ...updates,
      toggles: { ...current.toggles, ...(updates.toggles ?? {}) },
    };
    bump();
  }

  return { updateViewState };
}
