import type { Diagram } from "../models/diagram.ts";
import type { Index, IndexColumn } from "../models/keys.ts";
import type { Table, UniqueKey } from "../models/table.ts";
import type { Command } from "./command.ts";

/** The keys of a table, all four channels together. */
export type TableKeyChannels = Pick<
  Table,
  "primaryKey" | "uniqueKeys" | "foreignKeys" | "indices"
>;

type ChannelKey = "primaryKey" | "uniqueKeys" | "foreignKeys" | "indices";

/**
 * Replaces the key channels of a table and puts the old ones back on undo.
 *
 * Every key operation is one command, so a key can be added, renamed, given a
 * column or removed with one step of the history (design section 3.8.3,
 * ruling 3). The command keeps only the channels it was given, which keeps the
 * undo of a rename from touching the columns.
 */
export class SetTableKeysCommand implements Command {
  private readonly diagram: Diagram;
  private readonly tableId: string;
  private readonly patch: Partial<TableKeyChannels>;
  private readonly label: string;
  private previous: Partial<TableKeyChannels> = {};
  private applied = false;

  constructor(diagram: Diagram, tableId: string, patch: Partial<TableKeyChannels>, label: string) {
    this.diagram = diagram;
    this.tableId = tableId;
    this.patch = patch;
    this.label = label;
  }

  get description(): string {
    return this.label;
  }

  execute(): void {
    const table = this.table();
    if (!table) return;
    this.previous = {};
    const target = table as unknown as Record<string, unknown>;
    for (const channel of Object.keys(this.patch) as ChannelKey[]) {
      this.previous[channel] = table[channel] as never;
      target[channel] = this.patch[channel];
    }
    this.applied = true;
  }

  undo(): void {
    if (!this.applied) return;
    const table = this.table();
    if (!table) return;
    const target = table as unknown as Record<string, unknown>;
    for (const channel of Object.keys(this.previous) as ChannelKey[]) {
      target[channel] = this.previous[channel];
    }
    this.previous = {};
    this.applied = false;
  }

  private table(): Table | undefined {
    return this.diagram.tables.find((entry) => String(entry.id) === String(this.tableId));
  }
}

function keysOfKind(table: Table, kind: "unique" | "index"): UniqueKey[] | Index[] {
  switch (kind) {
    case "unique":
      return [...(table.uniqueKeys ?? [])];
    case "index":
      return [...(table.indices ?? [])];
    default:
      return [];
  }
}

/**
 * Adds a unique key or an index to a table.
 *
 * The primary key and the foreign keys are not added this way: a primary key
 * follows the primary flag of the fields, and a foreign key follows the
 * relationship it names (INV-10).
 */
export function addTableKey(
  diagram: Diagram,
  tableId: string,
  kind: "unique" | "index",
  key: UniqueKey | Index,
): SetTableKeysCommand {
  const table = diagram.tables.find((entry) => String(entry.id) === String(tableId));
  const next = [...(table ? keysOfKind(table, kind) : []), key];
  const label = kind === "unique" ? `Add the unique key ${key.name}` : `Add the index ${key.name}`;
  return new SetTableKeysCommand(
    diagram,
    tableId,
    kind === "unique" ? { uniqueKeys: next as UniqueKey[] } : { indices: next as Index[] },
    label,
  );
}

/** Renames a key in one step; the columns stay untouched. */
export function renameTableKey(
  diagram: Diagram,
  tableId: string,
  kind: "unique" | "index",
  keyId: string,
  names: { name: string; logicalName?: string },
): SetTableKeysCommand {
  const table = diagram.tables.find((entry) => String(entry.id) === String(tableId));
  const next = (table ? keysOfKind(table, kind) : []).map((key) =>
    String(key.id) === String(keyId)
      ? { ...key, name: names.name, logicalName: names.logicalName ?? key.logicalName }
      : key,
  );
  const label =
    kind === "unique" ? `Rename the unique key to ${names.name}` : `Rename the index to ${names.name}`;
  return new SetTableKeysCommand(
    diagram,
    tableId,
    kind === "unique" ? { uniqueKeys: next as UniqueKey[] } : { indices: next as Index[] },
    label,
  );
}

/** Removes a unique key or an index in one step. */
export function removeTableKey(
  diagram: Diagram,
  tableId: string,
  kind: "unique" | "index",
  keyId: string,
): SetTableKeysCommand {
  const table = diagram.tables.find((entry) => String(entry.id) === String(tableId));
  const keys = table ? keysOfKind(table, kind) : [];
  const doomed = keys.find((key) => String(key.id) === String(keyId));
  const next = keys.filter((key) => String(key.id) !== String(keyId));
  const label = doomed
    ? kind === "unique"
      ? `Remove the unique key ${doomed.name}`
      : `Remove the index ${doomed.name}`
    : "Remove a key";
  return new SetTableKeysCommand(
    diagram,
    tableId,
    kind === "unique" ? { uniqueKeys: next as UniqueKey[] } : { indices: next as Index[] },
    label,
  );
}

/**
 * Sets the columns of a key, which is also how a column is added, removed or
 * moved: the caller hands in the whole new order.
 */
export function setKeyColumns(
  diagram: Diagram,
  tableId: string,
  kind: "unique" | "index",
  keyId: string,
  columns: IndexColumn[],
): SetTableKeysCommand {
  const table = diagram.tables.find((entry) => String(entry.id) === String(tableId));
  const keys = table ? keysOfKind(table, kind) : [];
  const named = keys.find((key) => String(key.id) === String(keyId));
  const next = keys.map((key) =>
    String(key.id) === String(keyId) ? { ...key, columns: columns.map((column) => ({ ...column })) } : key,
  );
  const label = named ? `Change the columns of ${named.name}` : "Change the columns of a key";
  return new SetTableKeysCommand(
    diagram,
    tableId,
    kind === "unique" ? { uniqueKeys: next as UniqueKey[] } : { indices: next as Index[] },
    label,
  );
}

