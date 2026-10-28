/**
 * The inline icons of the toolbar (plan Task 4: no new dependency, so the
 * icons are lucide-style strokes kept here). Every entry is the inner markup
 * of a 24×24 stroked SVG.
 */
export const TOOLBAR_ICONS: Record<string, string> = {
  // Display modes: the density of the rows under the header grows.
  "mode-entity": '<rect x="3" y="6" width="18" height="12" rx="2"/>',
  "mode-definition":
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h10"/>',
  "mode-attributes":
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10"/><path d="M7 12h10"/><path d="M7 15h10"/>',
  "mode-all":
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10"/><path d="M7 10.5h10"/><path d="M7 14h10"/><path d="M7 17.5h6"/>',
  "mode-custom":
    '<path d="M4 8h8"/><path d="M18 8h2"/><circle cx="15" cy="8" r="2"/><path d="M4 16h2"/><path d="M12 16h8"/><circle cx="9" cy="16" r="2"/>',
  // View toggles.
  "toggle-description":
    '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h9"/>',
  "toggle-fields":
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M3 14h18"/><path d="M9 9v11"/>',
  "toggle-keys":
    '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8"/><path d="M16 5l3 3"/>',
  "toggle-indexes":
    '<path d="M4 6h16"/><path d="M8 12h12"/><path d="M12 18h8"/>',
  // Layers.
  "view-layer":
    '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  // Zoom and full screen.
  "zoom-in":
    '<circle cx="10" cy="10" r="6"/><path d="M21 21l-5.8-5.8"/><path d="M10 8v4"/><path d="M8 10h4"/>',
  "zoom-out":
    '<circle cx="10" cy="10" r="6"/><path d="M21 21l-5.8-5.8"/><path d="M8 10h4"/>',
  fullscreen: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  // History.
  undo: '<path d="M8 5L3 10l5 5"/><path d="M3 10h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M16 5l5 5-5 5"/><path d="M21 10H10a5 5 0 0 0 0 10h3"/>',
  // File.
  "file-new":
    '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 12v6"/><path d="M9 15h6"/>',
  "file-open":
    '<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7v12"/>',
  "file-save":
    '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M8 21v-8h8v8"/>',
  // Layout (design 6.3): a grid, a flow of rows, and the auto flow.
  "layout-grid":
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  "layout-flow":
    '<rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><rect x="3" y="14" width="8" height="6" rx="1"/><rect x="13" y="14" width="8" height="6" rx="1"/>',
  "layout-auto":
    '<path d="M4 7h6"/><path d="M14 7h6"/><path d="M7 7l3 5"/><path d="M17 7l-3 5"/><rect x="8" y="14" width="8" height="6" rx="1"/>',
  // Alignment (design 6.5).
  "align-left":
    '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>',
  "align-center-h":
    '<path d="M12 3v18"/><rect x="4" y="6" width="16" height="4" rx="1"/><rect x="7" y="14" width="10" height="4" rx="1"/>',
  "align-right":
    '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>',
  "align-top":
    '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>',
  "align-center-v":
    '<path d="M3 12h18"/><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/>',
  "align-bottom":
    '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>',
  "distribute-h":
    '<path d="M4 3v18"/><path d="M20 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  "distribute-v":
    '<path d="M3 4h18"/><path d="M3 20h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  // Zoom helpers (design 6.6).
  "zoom-fit":
    '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/><rect x="9" y="10" width="6" height="4" rx="1"/>',
  "zoom-selection":
    '<path d="M4 8V4h4"/><path d="M16 4h4v4"/><path d="M20 16v4h-4"/><path d="M8 20H4v-4"/><circle cx="12" cy="12" r="2"/>',
  "zoom-reset":
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9 11l3-3 3 3"/>',
  // File extras (design 6.8).
  "file-save-as":
    '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M15 14l4 4"/><path d="M19 14v4h-4"/>',
  "file-import":
    '<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M4 17v3h16v-3"/>',
  "file-export":
    '<path d="M12 13V3"/><path d="M8 7l4-4 4 4"/><path d="M4 17v3h16v-3"/>',
  // Config (design 6.9, the group is still to be decided).
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M5 5l3 3"/><path d="M16 16l3 3"/><path d="M19 5l-3 3"/><path d="M8 16l-3 3"/>',
  // Scope indicator.
  scope:
    '<circle cx="12" cy="12" r="7"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
};
