/**
 * The shape of the menu bar of the editor.
 *
 * The menu bar is data driven, so that the host application can add, remove
 * or rename entries without replacing the component.
 *
 * The entries are declared as types and not as interfaces, because the menu
 * of Naive UI accepts an index signature and an interface does not have one.
 */
export type MenuBarItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

export type MenuBarGroup = {
  key: string;
  label: string;
  items: MenuBarItem[];
};

export const DEFAULT_MENU_GROUPS: MenuBarGroup[] = [
  {
    key: "file",
    label: "File",
    items: [
      { key: "new", label: "New diagram" },
      { key: "open", label: "Open" },
      { key: "save", label: "Save" },
      { key: "import-sql", label: "Import SQL" },
      { key: "import-json", label: "Import JSON" },
      { key: "export-sql", label: "Export SQL" },
      { key: "export-dbml", label: "Export DBML" },
      { key: "export-json", label: "Export JSON" },
      { key: "export-png", label: "Export PNG" },
      { key: "toggle-fullscreen", label: "Fullscreen" },
    ],
  },
  {
    key: "edit",
    label: "Edit",
    items: [
      { key: "add-table", label: "Add table" },
      { key: "add-relationship", label: "Add relationship" },
      { key: "add-note", label: "Add note" },
      { key: "add-area", label: "Add area" },
      { key: "auto-layout", label: "Auto layout" },
      { key: "auto-relationships", label: "Auto create relationships" },
      { key: "delete", label: "Delete selection" },
    ],
  },
  {
    key: "view",
    label: "View",
    items: [
      { key: "zoom-in", label: "Zoom in" },
      { key: "zoom-out", label: "Zoom out" },
      { key: "reset-view", label: "Reset view" },
      { key: "toggle-grid", label: "Toggle grid" },
      { key: "toggle-sidebar", label: "Toggle side panel" },
      { key: "toggle-view-mode", label: "Toggle view mode" },
      { key: "validate", label: "Validate diagram" },
    ],  },
  {
    key: "help",
    label: "Help",
    items: [
      { key: "documentation", label: "Documentation" },
      { key: "about", label: "About drawDB" },
    ],
  },
];
