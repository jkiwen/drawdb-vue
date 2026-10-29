import {
  addTableKey,
  CompositeCommand,
  nextKeyName,
  removeTableKey,
  renameTableKey,
  setKeyColumns,
  SetTableKeysCommand,
  UpdateRelationshipCommand,
} from "@drawdb/core";
import type {
  Command,
  Diagram,
  Index,
  IndexColumn,
  PrimaryKey,
  RelationshipId,
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
  renameForeignKey: (
    tableId: TableId,
    relationshipId: RelationshipId,
    names: { name: string; logicalName?: string },
  ) => void;
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
    renameForeignKey(tableId, relationshipId, names) {
      const table = diagram.tables.find((item) => String(item.id) === String(tableId));
      if (table === undefined) return;
      const keys = (table.foreignKeys ?? []).map((key) =>
        String(key.relationshipId) === String(relationshipId)
          ? { ...key, name: names.name, logicalName: names.logicalName ?? key.logicalName }
          : key,
      );
      // The key object and the relationship carry one name (plan Task 7):
      // the relationship is what the canvas and the outline read today, so
      // the two move in one step of the history.
      run(
        new CompositeCommand("Rename the foreign key", [
          new SetTableKeysCommand(diagram, String(tableId), { foreignKeys: keys }, "Rename the foreign key"),
          new UpdateRelationshipCommand(diagram, relationshipId, { name: names.name }),
        ]),
      );
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
