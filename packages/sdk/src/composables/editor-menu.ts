import type { EditorDialogName, ImportFormat } from "../stores/dialogs.ts";

/**
 * The dialogs the editor can open from the menu bar.
 */
export type EditorMenuDialog = EditorDialogName;

/**
 * The actions the menu bar can trigger. Every action is a callback so the
 * dispatcher stays free of any store or component dependency.
 */
export interface EditorMenuActions {
  save(): void;
  exportSql(): void;
  exportDbml(): void;
  exportJson(): void;
  openDialog(dialog: EditorMenuDialog, options?: { format?: ImportFormat }): void;
  addTable(): void;
  addNote(): void;
  addArea(): void;
  autoLayout(): void;
  autoRelationships(): void;
  addRelationship(): void;
  deleteSelection(): void;
  toggleFullscreen(): void;
  toggleSidebar(): void;
  toggleViewMode(): void;
  toggleGrid(): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  validate(): void;
}

/**
 * The menu keys the editor answers on its own. Every other key belongs to the
 * host application: it owns the file browser and the documentation.
 */
const HOST_OWNED_KEYS = new Set([
  "file:new",
  "file:open",
  "help:documentation",
  "help:about",
]);

/**
 * Runs the menu action behind a menu key.
 *
 * Returns `true` when the editor handled the key and `false` when the host
 * application has to deal with it.
 */
export function runEditorMenu(
  key: string,
  actions: EditorMenuActions,
): boolean {
  switch (key) {
    case "file:save":
      actions.save();
      return true;
    case "file:export-sql":
      actions.exportSql();
      actions.openDialog("sqlPreview", { format: "sql" });
      return true;
    case "file:export-dbml":
      actions.exportDbml();
      actions.openDialog("sqlPreview", { format: "dbml" });
      return true;
    case "file:export-json":
      actions.exportJson();
      return true;
    case "file:import-sql":
      actions.openDialog("import", { format: "sql" });
      return true;
    case "file:import-json":
      actions.openDialog("import", { format: "json" });
      return true;
    case "file:export-png":
      actions.openDialog("imageExport");
      return true;
    case "file:toggle-fullscreen":
      actions.toggleFullscreen();
      return true;
    case "edit:add-table":
      actions.addTable();
      return true;
    case "edit:add-note":
      actions.addNote();
      return true;
    case "edit:add-area":
      actions.addArea();
      return true;
    case "edit:auto-layout":
      actions.autoLayout();
      return true;
    case "edit:auto-relationships":
      actions.autoRelationships();
      return true;
    case "edit:add-relationship":
      actions.addRelationship();
      return true;
    case "edit:delete":
      actions.deleteSelection();
      return true;
    case "view:toggle-sidebar":
      actions.toggleSidebar();
      return true;
    case "view:toggle-view-mode":
      actions.toggleViewMode();
      return true;
    case "view:toggle-grid":
      actions.toggleGrid();
      return true;
    case "view:zoom-in":
      actions.zoomIn();
      return true;
    case "view:zoom-out":
      actions.zoomOut();
      return true;
    case "view:validate":
      actions.validate();
      return true;
    default:
      break;
  }

  // The older menu keys are still in the wild, so the editor keeps answering
  // them even though the menu bar sends the new ones.
  if (key === "file:auto-relationships") {
    actions.autoRelationships();
    return true;
  }

  if (key === "view:reset-zoom" || key === "view:reset-view") {
    actions.resetView();
    return true;
  }

  if (HOST_OWNED_KEYS.has(key)) {
    return false;
  }

  return false;
}

/**
 * Tells whether a menu key belongs to the host application.
 */
export function isHostOwnedMenuKey(key: string): boolean {
  return HOST_OWNED_KEYS.has(key);
}
