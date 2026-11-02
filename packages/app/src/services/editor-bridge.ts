/**
 * The bridge the end to end tests use to drive the editor.
 *
 * The tests run in the browser, so they cannot reach into the component tree
 * of the application. The bridge is a plain object of functions on the window,
 * which the tests call with `page.evaluate`.
 */

/** The instance of the editor of the SDK, as the host application uses it. */
export interface BridgeEditor {
  /** Arranges the tables of the diagram. */
  autoArrange(): void;
  /** Returns the issues of the diagram. */
  validate(): unknown[];
  /** Opens the tab that lists the issues of the diagram. */
  openIssuesTab(): void;
  /** Returns the SQL of the diagram. */
  exportSql(): string;
  /** Returns the DBML of the diagram. */
  exportDbml(): string;
  /** Replaces the diagram with the one the SQL describes. */
  importSql(sql: string, database?: string): unknown;
  /** Moves the history to a position: `depth` commands applied. */
  jumpHistory(depth: number): boolean;
  /** Runs a command that a plugin registered. */
  runCommand(key: string): boolean;
  /** Returns a copy of the diagram the editor shows. */
  getDiagram(): unknown;
}

/** The shape of the bridge on the window. */
export interface EditorBridge {
  /** The instance of the editor, as far as it is mounted. */
  readonly editor: BridgeEditor | undefined;
  /** Returns the SQL of the diagram. */
  exportSql(): string;
  /** Returns the DBML of the diagram. */
  exportDbml(): string;
  /** Replaces the diagram with the one the SQL describes. */
  importSql(sql: string, database?: string): unknown;
  /** Moves the history to a position: `depth` commands applied. */
  jumpHistory(depth: number): boolean;
  /** Runs a command that a plugin registered. */
  runCommand(key: string): boolean;
  /** Returns a copy of the diagram the editor shows. */
  getDiagram(): unknown;
  /** Returns the issues of the diagram. */
  validate(): unknown[];
  /** Arranges the tables of the diagram. */
  autoArrange(): void;
}

/** The name of the property the bridge is published under. */
export const BRIDGE_PROPERTY = "__DRAWDB__";

/**
 * Builds the bridge of the editor.
 *
 * The bridge reads the editor through the function it is given, so that it
 * always talks to the editor that is mounted at that moment.
 */
export function createEditorBridge(
  getEditor: () => BridgeEditor | undefined,
): EditorBridge {
  return {
    get editor(): BridgeEditor | undefined {
      return getEditor();
    },
    exportSql: (): string => getEditor()?.exportSql() ?? "",
    exportDbml: (): string => getEditor()?.exportDbml() ?? "",
    importSql: (sql: string, database?: string): unknown =>
      getEditor()?.importSql(sql, database),
    jumpHistory: (depth: number): boolean => getEditor()?.jumpHistory(depth) ?? false,
    runCommand: (key: string): boolean => getEditor()?.runCommand(key) ?? false,
    getDiagram: (): unknown => getEditor()?.getDiagram(),
    validate: (): unknown[] => getEditor()?.validate() ?? [],
    autoArrange: (): void => {
      getEditor()?.autoArrange();
    },
  };
}

/** Publishes the bridge on the window of the browser. */
export function installEditorBridge(bridge: EditorBridge): void {
  (globalThis as unknown as Record<string, unknown>)[BRIDGE_PROPERTY] = bridge;
}

/** Removes the bridge from the window of the browser. */
export function removeEditorBridge(): void {
  delete (globalThis as unknown as Record<string, unknown>)[BRIDGE_PROPERTY];
}
