/**
 * The shape of the menu bar of the editor.
 *
 * The menu bar is data driven, so that the host application can add, remove
 * or rename entries without replacing the component.
 */
export interface MenuBarItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export interface MenuBarGroup {
  key: string;
  label: string;
  items: MenuBarItem[];
}

export const DEFAULT_MENU_GROUPS: MenuBarGroup[] = [
  {
    key: "file",
    label: "File",
    items: [
      { key: "new", label: "New diagram" },
      { key: "open", label: "Open" },
      { key: "save", label: "Save" },
      { key: "import-sql", label: "Import SQL" },
      { key: "export-sql", label: "Export SQL" },
      { key: "export-dbml", label: "Export DBML" },
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
    ],
  },
  {
    key: "help",
    label: "Help",
    items: [
      { key: "documentation", label: "Documentation" },
      { key: "about", label: "About drawDB" },
    ],
  },
];
