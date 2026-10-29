import { addTableKey, nextKeyName, removeTableKey, renameTableKey, setKeyColumns } from "@drawdb/core";
import type {
  Command,
  Diagram,
  FieldId,
  Index,
  IndexColumn,
  PrimaryKey,
  Table,
  TableId,
  UniqueKey,
} from "@drawdb/core";
import type { useHistoryStore } from "./history.ts";

type History = ReturnType<typeof useHistoryStore>;

/**
 * The key writes of the edit panel.
 *
 * A key is an object of its own now (design section 3.8.3): adding, renaming,
 * giving it columns or removing it are separate commands, so one edit of one
 * key is one step of the history. The commands live in the core; this file
 * only gives the panel a place to call them from.
 */
export class SetPrimaryKeyCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: TableId;
  private readonly columns: IndexColumn[];
  private readonly name: string | undefined;
  private previousKey: PrimaryKey | undefined;
  private previousFlags: { id: FieldId; primary: boolean }[] = [];

  constructor(diagram: Diagram, tableId: TableId, columns: IndexColumn[], name?: string) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.columns = columns;
    this.name = name;
  }

  get description(): string {
    return "Change the primary key";
  }

  execute(): void {
    const table = this.table();
    if (!table) return;
    this.previousKey = table.primaryKey;
    this.previousFlags = table.fields.map((field) => ({
      id: field.id,
      primary: field.primary === true,
    }));

    const members = new Set(this.columns.map((column) => String(column.fieldId)));
    for (const field of table.fields) {
      field.primary = members.has(String(field.id));
    }

    table.primaryKey =
      this.columns.length === 0
        ? undefined
        : {
            id: table.primaryKey?.id ?? `pk_${String(table.id)}`,
            name: this.name ?? table.primaryKey?.name ?? "",
            logicalName: table.primaryKey?.logicalName ?? "",
            columns: this.columns.map((column) => ({ ...column })),
          };
  }

  undo(): void {
    const table = this.table();
    if (!table) return;
    table.primaryKey = this.previousKey;
    for (const flag of this.previousFlags) {
      const field = table.fields.find((entry) => String(entry.id) === String(flag.id));
      if (field) field.primary = flag.primary;
    }
  }

  private table(): Table | undefined {
    return this.diagram.tables.find((entry) => String(entry.id) === String(this.tableId));
  }
}

export interface KeyActions {
  addUniqueKey: (tableId: TableId, key: UniqueKey) => void;
  renameUniqueKey: (tableId: TableId, keyId: string, names: { name: string; logicalName?: string }) => void;
  removeUniqueKey: (tableId: TableId, keyId: string) => void;
  setUniqueColumns: (tableId: TableId, keyId: string, columns: IndexColumn[]) => void;
  addIndex: (tableId: TableId, key: Index) => void;
  renameIndex: (tableId: TableId, keyId: string, names: { name: string; logicalName?: string }) => void;
  removeIndex: (tableId: TableId, keyId: string) => void;
  setIndexColumns: (tableId: TableId, keyId: string, columns: IndexColumn[]) => void;
  setPrimaryColumns: (tableId: TableId, columns: IndexColumn[], name?: string) => void;
}

export function keyActions(diagram: Diagram, history: History, bump: () => void): KeyActions {
  function run(command: Command): void {
    history.execute(command);
    bump();
  }

  return {
    addUniqueKey(tableId, key) {
      run(addTableKey(diagram, String(tableId), "unique", key));
    },
    renameUniqueKey(tableId, keyId, names) {
      run(renameTableKey(diagram, String(tableId), "unique", keyId, names));
    },
    removeUniqueKey(tableId, keyId) {
      run(removeTableKey(diagram, String(tableId), "unique", keyId));
    },
    setUniqueColumns(tableId, keyId, columns) {
      run(setKeyColumns(diagram, String(tableId), "unique", keyId, columns));
    },
    addIndex(tableId, key) {
      run(addTableKey(diagram, String(tableId), "index", key));
    },
    renameIndex(tableId, keyId, names) {
      run(renameTableKey(diagram, String(tableId), "index", keyId, names));
    },
    removeIndex(tableId, keyId) {
      run(removeTableKey(diagram, String(tableId), "index", keyId));
    },
    setIndexColumns(tableId, keyId, columns) {
      run(setKeyColumns(diagram, String(tableId), "index", keyId, columns));
    },
    setPrimaryColumns(tableId, columns, name) {
      run(new SetPrimaryKeyCommand(diagram, tableId, columns, name));
    },
  };
}

/** The name a new unique key or index gets when the panel does not ask for one. */
export function suggestedKeyName(kind: "unique" | "index", table: Table): string {
  const taken = [
    ...(table.uniqueKeys ?? []).map((key) => key.name),
    ...(table.indices ?? []).map((key) => key.name),
    ...(table.foreignKeys ?? []).map((key) => key.name),
    table.primaryKey?.name ?? "",
  ];
  return nextKeyName(kind, table.name || "table", undefined, taken);
}
