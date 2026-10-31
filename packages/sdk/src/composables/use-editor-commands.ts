import {
  exportDBML,
  exportSQL,
  exportDiagramJson,
  importSQL,
  deepClone,
  validateDiagram,
} from "@drawdb/core";
import type { DatabaseType, Diagram } from "@drawdb/core";
import type { DiagramStore } from "../stores/diagram.ts";
import type { SaveStore } from "../stores/save.ts";
import type { UIStore } from "../stores/ui.ts";
import type { EditorDialogName, ImportFormat } from "../stores/dialogs.ts";
import { runEditorMenu } from "./editor-menu.ts";
import { useImportWizardStore } from "../stores/import-wizard.ts";
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
  /**
   * Reports the dialog a menu entry asks for.
   *
   * The editor renders the dialogs itself, so the callback only carries the
   * name of the dialog and the options it was opened with.
   */
  onOpenDialog?: (
    dialog: EditorDialogName,
    options?: { format?: ImportFormat },
  ) => void;
  /** Reports the JSON of the diagram, so that the host can save it. */
  onExportJson?: (json: string) => void;
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
  /** Deletes the tables, fields and relations that are selected. */
  deleteSelection(): void;
  /** Returns the JSON of the diagram. */
  exportJson(): string;
  /**
   * Handles an entry of the menu of the header.
   *
   * Returns `true` when the editor answered the entry and `false` when the
   * host application has to handle it.
   */
  onMenu(key: string): boolean;
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
  const importWizard = useImportWizardStore();

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
    diagramStore.addArea(area);
    uiStore.selectArea(String(area.id));
  }

  function exportJson(): string {
    return exportDiagramJson(diagramStore.diagram, { pretty: true });
  }

  /**
   * Deletes the current selection.
   *
   * The fields come first, because a selected field belongs to a selected
   * table and removing the table would take the field with it.
   */
  function deleteSelection(): void {
    if (uiStore.selectedFields.length > 0) {
      for (const field of [...uiStore.selectedFields]) {
        diagramStore.removeField(field.tableId, field.fieldId);
      }
      uiStore.clearSelection();
      return;
    }

    if (uiStore.selectedTableIds.length > 0) {
      for (const tableId of [...uiStore.selectedTableIds]) {
        diagramStore.removeTable(tableId);
      }
      uiStore.clearSelection();
      return;
    }

    if (uiStore.selectedRelationshipIds.length > 0) {
      for (const relationshipId of [...uiStore.selectedRelationshipIds]) {
        diagramStore.removeRelationship(relationshipId);
      }
      uiStore.clearSelection();
      return;
    }

    if (uiStore.selectedNoteIds.length > 0) {
      for (const noteId of [...uiStore.selectedNoteIds]) {
        diagramStore.removeEntity("notes", noteId);
      }
      uiStore.clearSelection();
      return;
    }

    if (uiStore.selectedAreaIds.length > 0) {
      for (const areaId of [...uiStore.selectedAreaIds]) {
        diagramStore.removeArea(areaId);
      }
      uiStore.clearSelection();
    }
  }

  function onMenu(key: string): boolean {
    return runEditorMenu(key, {
      save: () => void runSave(),
      exportSql: () => options.onExportSql(exportSql()),
      exportDbml: () => options.onExportDbml(exportDbml()),
      exportJson: () => options.onExportJson?.(exportJson()),
      openDialog: (dialog, dialogOptions) =>
        options.onOpenDialog?.(dialog, dialogOptions),
      openImport: (format) => importWizard.begin(format),
      addTable,
      addNote,
      addArea,
      autoLayout: () => diagramStore.autoArrange(),
      autoRelationships: () => options.onOpenDialog?.("autoRelationships"),
      addRelationship: () => options.onOpenDialog?.("relationship"),
      deleteSelection,
      toggleFullscreen: () => uiStore.setFullscreen(!uiStore.isFullscreen),
      toggleSidebar: () => uiStore.toggleSidebar(),
      toggleViewMode: () => uiStore.toggleViewMode(),
      toggleGrid: () => uiStore.toggleGrid(),
      zoomIn: () => uiStore.zoomIn(),
      zoomOut: () => uiStore.zoomOut(),
      resetView: () => uiStore.resetView(),
      validate: () => {
        validateDiagram(diagramStore.diagram);
        uiStore.setActiveTab("issues");
      },
    });
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
    exportJson,
    importSql,
    addTable,
    addNote,
    addArea,
    deleteSelection,
    onMenu,
    configureAutoSave,
    stopAutoSave,
  };
}
