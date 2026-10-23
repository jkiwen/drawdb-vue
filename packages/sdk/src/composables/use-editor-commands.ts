import { exportDBML, exportSQL, importSQL, deepClone } from "@drawdb/core";
import type { DatabaseType, Diagram } from "@drawdb/core";
import type { DiagramStore } from "../stores/diagram.ts";
import type { SaveStore } from "../stores/save.ts";
import type { UIStore } from "../stores/ui.ts";
import {
  createArea,
  createNote,
  createTable,
  uniqueTableName,
} from "../utils/elements.ts";

export interface EditorCommandsOptions {
  diagramStore: DiagramStore;
  uiStore: UIStore;
  saveStore: SaveStore;
  /** Reports the diagram that was saved. */
  onSave: (diagram: Diagram) => void;
  /** Reports the SQL of the diagram. */
  onExportSql: (sql: string) => void;
  /** Reports the DBML of the diagram. */
  onExportDbml: (dbml: string) => void;
  /** Reports the diagram that was imported. */
  onImportSql: (diagram: Diagram) => void;
  /** Reports a failure to the host application. */
  onError: (error: Error) => void;
  /** Called after an import, so that the editor can forget the last echo. */
  onImported?: () => void;
}

export interface EditorCommandsApi {
  /** Saves the diagram with the storage adapter of the host application. */
  runSave(): Promise<void>;
  /** Returns the SQL of the diagram. */
  exportSql(): string;
  /** Returns the DBML of the diagram. */
  exportDbml(): string;
  /** Replaces the diagram with the one the SQL describes. */
  importSql(sql: string, database?: DatabaseType): Diagram;
  /** Adds a table to the diagram. */
  addTable(): void;
  /** Adds a note to the diagram. */
  addNote(): void;
  /** Adds an area to the diagram. */
  addArea(): void;
  /** Handles an entry of the menu of the header. */
  onMenu(key: string): void;
  /** Starts or stops the automatic saving. */
  configureAutoSave(enabled: boolean, interval: number): void;
  /** Stops the automatic saving. */
  stopAutoSave(): void;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * The commands of the editor.
 *
 * The composable holds everything the header, the toolbars and the host
 * application can ask the editor to do.
 */
export function useEditorCommands(
  options: EditorCommandsOptions,
): EditorCommandsApi {
  const { diagramStore, uiStore, saveStore } = options;

  let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

  async function runSave(): Promise<void> {
    try {
      await saveStore.save();
      options.onSave(deepClone(diagramStore.diagram));
    } catch (cause) {
      options.onError(toError(cause));
    }
  }

  function exportSql(): string {
    return exportSQL(diagramStore.diagram);
  }

  function exportDbml(): string {
    return exportDBML(diagramStore.diagram);
  }

  function importSql(
    sql: string,
    database: DatabaseType = diagramStore.diagram.database,
  ): Diagram {
    const imported = importSQL(sql, database);
    diagramStore.setDiagram(imported);
    options.onImported?.();
    options.onImportSql(imported);
    return imported;
  }

  function addTable(): void {
    const table = createTable(
      uniqueTableName(diagramStore.tables),
      { x: 100 + diagramStore.tables.length * 260, y: 100 },
    );
    diagramStore.addTable(table);
    uiStore.selectTable(String(table.id));
  }

  function addNote(): void {
    const note = createNote({
      x: 100 + diagramStore.notes.length * 260,
      y: 100,
    });
    diagramStore.addEntity("notes", note);
    uiStore.selectNote(String(note.id));
  }

  function addArea(): void {
    const area = createArea(
      uniqueTableName(diagramStore.areas, "area"),
      { x: 100 + diagramStore.areas.length * 260, y: 100 },
    );
    diagramStore.addEntity("areas", area);
    uiStore.selectArea(String(area.id));
  }

  function onMenu(key: string): void {
    switch (key) {
      case "file:save":
        void runSave();
        break;
      case "file:export-sql":
        options.onExportSql(exportSql());
        break;
      case "file:export-dbml":
        options.onExportDbml(exportDbml());
        break;
      case "edit:add-table":
        addTable();
        break;
      case "edit:add-note":
        addNote();
        break;
      case "edit:add-area":
        addArea();
        break;
      case "view:toggle-sidebar":
        uiStore.toggleSidebar();
        break;
      case "view:toggle-view-mode":
        uiStore.toggleViewMode();
        break;
      case "view:toggle-grid":
        uiStore.toggleGrid();
        break;
      case "view:zoom-in":
        uiStore.zoomIn();
        break;
      case "view:zoom-out":
        uiStore.zoomOut();
        break;
      case "view:reset-zoom":
        uiStore.resetView();
        break;
      default:
        break;
    }
  }

  function stopAutoSave(): void {
    if (autoSaveTimer === undefined) {
      return;
    }
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }

  function configureAutoSave(enabled: boolean, interval: number): void {
    stopAutoSave();
    if (!enabled) {
      return;
    }
    autoSaveTimer = setInterval(() => {
      void runSave();
    }, Math.max(1, interval));
    // The timer must not keep a Node process alive when the editor is rendered
    // on the server. Browsers do not have `unref`, so the call is optional.
    (autoSaveTimer as unknown as { unref?: () => void }).unref?.();
  }

  return {
    runSave,
    exportSql,
    exportDbml,
    importSql,
    addTable,
    addNote,
    addArea,
    onMenu,
    configureAutoSave,
    stopAutoSave,
  };
}
