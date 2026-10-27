import { isKeyword } from "../export/shared.ts";
import type { DatabaseType } from "../models/diagram.ts";
import type { Enum } from "../models/enum.ts";
import type { Field, FieldId } from "../models/field.ts";
import type {
  Relationship,
  RelationshipFieldPair,
} from "../models/relationship.ts";
import type { Index, Table, UniqueConstraint } from "../models/table.ts";
import { arrangeTables } from "../utils/arrange-tables.ts";
import { createId } from "../utils/id.ts";
import type {
  ParsedDBML,
  ParsedDBMLField,
  ParsedDBMLIndex,
  ParsedDBMLTable,
} from "./parse.ts";
import { isInlineEnumType, typeTakesSize } from "./types.ts";

/** Default table colour, matching the React drawDB default. */
export const DEFAULT_TABLE_COLOR = "#175e7a";

/** Default table width used when a table has no explicit width. */
export const DEFAULT_TABLE_WIDTH = 220;

const NEW_TABLE_GAP_X = 80;
const NEW_TABLE_GAP_Y = 240;

export interface ReconciledDBML {
  tables: Table[];
  relationships: Relationship[];
  enums: Enum[];
}

function sameList<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Match parsed items to existing items by name.
 *
 * Exact names win first, then case-insensitive names, and finally the
 * remaining items are paired in order when `canRename` allows it.
 */
function matchByName<P extends { name: string }, B extends { name: string }>(
  parsedItems: P[],
  baseItems: B[],
  canRename: (parsed: P, base: B) => boolean,
): Map<number, B> {
  const matched = new Map<number, B>();
  const usedBase = new Set<number>();

  const claim = (parsedIndex: number, baseIndex: number) => {
    matched.set(parsedIndex, baseItems[baseIndex]);
    usedBase.add(baseIndex);
  };

  const findFreeBase = (predicate: (item: B) => boolean) =>
    baseItems.findIndex((item, i) => !usedBase.has(i) && predicate(item));

  parsedItems.forEach((parsed, i) => {
    const exact = findFreeBase((item) => item.name === parsed.name);
    if (exact !== -1) claim(i, exact);
  });

  parsedItems.forEach((parsed, i) => {
    if (matched.has(i)) return;
    const name = String(parsed.name).toLowerCase();
    const insensitive = findFreeBase(
      (item) => String(item.name).toLowerCase() === name,
    );
    if (insensitive !== -1) claim(i, insensitive);
  });

  const unmatchedParsed = parsedItems
    .map((_, i) => i)
    .filter((i) => !matched.has(i));
  const unmatchedBase = baseItems
    .map((_, i) => i)
    .filter((i) => !usedBase.has(i));

  unmatchedParsed.forEach((parsedIndex, position) => {
    const baseIndex = unmatchedBase[position];
    if (baseIndex === undefined) return;
    if (!canRename(parsedItems[parsedIndex], baseItems[baseIndex])) return;
    claim(parsedIndex, baseIndex);
  });

  return matched;
}

function sharesFieldName(
  parsedTable: ParsedDBMLTable,
  baseTable: Table,
): boolean {
  const baseNames = new Set((baseTable.fields ?? []).map((f) => f.name));
  return parsedTable.fields.some((field) => baseNames.has(field.name));
}

function resolveType(parsed: ParsedDBMLField, base: Field): string {
  if (isInlineEnumType(parsed.type) && isInlineEnumType(base.fieldType.type)) {
    return base.fieldType.type;
  }
  return parsed.type;
}

function resolveDefault(parsed: ParsedDBMLField, base: Field): string {
  const sameKeyword =
    isKeyword(String(base.default ?? "")) &&
    String(base.default).toLowerCase() === String(parsed.default).toLowerCase();
  return sameKeyword ? String(base.default) : parsed.default;
}

function resolveSize(
  parsed: ParsedDBMLField,
  base: Field,
  type: string,
  database: DatabaseType,
): number | undefined {
  if (!typeTakesSize(type, database)) return base.fieldType.length;
  if (parsed.size === "") return undefined;
  if (String(base.fieldType.length) === String(parsed.size)) {
    return base.fieldType.length;
  }
  return Number(parsed.size);
}

function createField(parsed: ParsedDBMLField): Field {
  const field: Field = {
    id: createId(),
    name: parsed.name,
    fieldType: { type: parsed.type },
    fieldTypeSource: "imported",
    default: parsed.default,
    check: "",
    primary: parsed.primary,
    unique: parsed.unique,
    notNull: parsed.notNull,
    increment: parsed.increment,
    comment: parsed.comment,
  };

  if (parsed.size !== "") field.fieldType.length = Number(parsed.size);
  if (isInlineEnumType(parsed.type)) field.values = parsed.values ?? [];

  return field;
}

function mergeField(
  parsed: ParsedDBMLField,
  base: Field,
  database: DatabaseType,
): Field {
  const type = resolveType(parsed, base);
  const merged: Field = {
    ...base,
    name: parsed.name,
    fieldType: { ...base.fieldType, type },
    default: resolveDefault(parsed, base),
    primary: parsed.primary,
    unique: parsed.unique,
    notNull: parsed.notNull,
    increment: parsed.increment,
    comment: parsed.comment,
  };

  if (isInlineEnumType(type)) {
    merged.values = sameList(base.values, parsed.values)
      ? base.values
      : parsed.values ?? [];
  }

  const size = resolveSize(parsed, base, type, database);
  if (size === undefined) delete merged.fieldType.length;
  else merged.fieldType.length = size;

  return merged;
}

function reconcileFields(
  parsedFields: ParsedDBMLField[],
  baseFields: Field[],
  database: DatabaseType,
): Field[] {
  const matched = matchByName(parsedFields, baseFields, () => true);
  return parsedFields.map((parsed, i) => {
    const base = matched.get(i);
    return base ? mergeField(parsed, base, database) : createField(parsed);
  });
}

function mergeIndexEntry(
  parsed: ParsedDBMLIndex,
  base: Index | UniqueConstraint | undefined,
  position: number,
  resolvedFields: FieldId[],
): Index & UniqueConstraint {
  return {
    ...(base ?? {}),
    id: position,
    name: parsed.name,
    fields:
      base && sameList(base.fields, resolvedFields)
        ? base.fields
        : resolvedFields,
  } as Index & UniqueConstraint;
}

function reconcileIndexes(
  parsedIndexes: ParsedDBMLIndex[],
  baseTable: Table,
  fields: Field[],
): { indices: NonNullable<Table["indices"]>; uniqueConstraints: NonNullable<Table["uniqueConstraints"]> } {
  const baseIndices = baseTable.indices ?? [];
  const baseConstraints = baseTable.uniqueConstraints ?? [];
  const constraintNames = new Set(
    baseConstraints.filter((c) => c.name).map((c) => c.name),
  );

  const indices: NonNullable<Table["indices"]> = [];
  const uniqueConstraints: NonNullable<Table["uniqueConstraints"]> = [];

  for (const parsed of parsedIndexes) {
    // Parsed DBML references fields by name; the model stores field ids.
    const resolvedFields = parsed.fields.map(
      (name) => fields.find((f) => f.name === name)?.id ?? name,
    );
    if (parsed.unique && constraintNames.has(parsed.name)) {
      const base = baseConstraints.find((c) => c.name === parsed.name);
      uniqueConstraints.push({
        ...mergeIndexEntry(parsed, base, uniqueConstraints.length, resolvedFields),
        name: parsed.name,
        fields: base?.fields ?? resolvedFields,
      });
    } else {
      const base =
        baseIndices.find((index) => index.name === parsed.name) ??
        baseIndices[indices.length];
      indices.push({
        ...mergeIndexEntry(parsed, base, indices.length, resolvedFields),
        unique: parsed.unique,
      });
    }
  }

  return { indices, uniqueConstraints };
}

function mergeTable(
  parsed: ParsedDBMLTable,
  base: Table,
  database: DatabaseType,
): Table {
  const fields = reconcileFields(parsed.fields, base.fields ?? [], database);
  return {
    ...base,
    name: parsed.name,
    comment: parsed.comment,
    color: parsed.color ?? base.color,
    fields,
    ...reconcileIndexes(parsed.indices, base, fields),
  };
}

function createTable(parsed: ParsedDBMLTable): Table {
  const fields = parsed.fields.map(createField);
  return {
    id: createId(),
    name: parsed.name,
    logical: { id: createId(), name: parsed.name, attributes: [] },
    comment: parsed.comment,
    color: parsed.color ?? DEFAULT_TABLE_COLOR,
    x: 0,
    y: 0,
    fields,
    indices: parsed.indices.map((index, i) => ({
      id: i,
      name: index.name,
      fields: index.fields.map(
        (name) => fields.find((f) => f.name === name)?.id ?? name,
      ),
      unique: index.unique,
    })),
    uniqueConstraints: [],
    locked: false,
    collapsed: false,
  };
}

function getTableWidth(table: Table): number {
  return typeof table.width === "number" && table.width > 0
    ? table.width
    : DEFAULT_TABLE_WIDTH;
}

function placeNewTables(tables: Table[]): void {
  const unplaced = tables.filter((table) => table.x === undefined);
  if (!unplaced.length) return;

  const placed = tables.filter((table) => table.x !== undefined);
  if (!placed.length) {
    arrangeTables(tables);
    return;
  }

  const x =
    Math.max(...placed.map((table) => table.x + getTableWidth(table))) +
    NEW_TABLE_GAP_X;
  const y = Math.min(...placed.map((table) => table.y));

  unplaced.forEach((table, i) => {
    table.x = x;
    table.y = y + i * NEW_TABLE_GAP_Y;
  });
}

function keepFieldlessTables(tables: Table[], baseTables: Table[]): void {
  const present = new Set(tables.map((table) => table.id));
  baseTables.forEach((table, index) => {
    if ((table.fields ?? []).length > 0 || present.has(table.id)) return;
    tables.splice(Math.min(index, tables.length), 0, table);
  });
}

function reconcileEnums(
  parsedEnums: Array<{ name: string; values: string[] }>,
  baseEnums: Enum[],
): Enum[] {
  const matched = matchByName(parsedEnums, baseEnums, () => true);
  return parsedEnums.map((parsed, i) => {
    const base = matched.get(i);
    return {
      ...base,
      id: base?.id ?? createId(),
      name: parsed.name,
      values:
        base && sameList(base.values, parsed.values)
          ? base.values
          : parsed.values,
    };
  });
}

function endpointSignature(rel: {
  startTableId: string | number;
  endTableId: string | number;
  fields: Array<{ startFieldId: string | number; endFieldId: string | number }>;
}): string {
  const pairs = rel.fields
    .map((pair) => `${pair.startFieldId}>${pair.endFieldId}`)
    .join(",");
  return `${rel.startTableId}|${rel.endTableId}|${pairs}`;
}

function resolveEndpoints(
  parsed: {
    startTableName: string;
    startFieldNames: string[];
    endTableName: string;
    endFieldNames: string[];
  },
  tables: Table[],
): {
  startTableId: string | number;
  endTableId: string | number;
  fields: Array<{ startFieldId: string | number; endFieldId: string | number }>;
} | null {
  const startTable = tables.find((table) => table.name === parsed.startTableName);
  const endTable = tables.find((table) => table.name === parsed.endTableName);
  if (!startTable || !endTable) return null;

  const fields: Array<{
    startFieldId: string | number;
    endFieldId: string | number;
  }> = [];
  for (let i = 0; i < parsed.startFieldNames.length; i++) {
    const startField = startTable.fields.find(
      (field) => field.name === parsed.startFieldNames[i],
    );
    const endField = endTable.fields.find(
      (field) => field.name === parsed.endFieldNames[i],
    );
    if (!startField || !endField) return null;
    fields.push({ startFieldId: startField.id, endFieldId: endField.id });
  }

  return { startTableId: startTable.id, endTableId: endTable.id, fields };
}

function normalizeRelationship(rel: Relationship) {
  return {
    startTableId: rel.startTableId,
    endTableId: rel.endTableId,
    fields:
      Array.isArray(rel.fields) && rel.fields.length
        ? rel.fields
        : [{ startFieldId: rel.startFieldId, endFieldId: rel.endFieldId }],
  };
}

function sameRelationshipFields(
  a: Array<{ startFieldId: string | number; endFieldId: string | number }> | undefined,
  b: Array<{ startFieldId: string | number; endFieldId: string | number }>,
): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every(
    (pair, i) =>
      pair.startFieldId === b[i].startFieldId &&
      pair.endFieldId === b[i].endFieldId,
  );
}

function reconcileRelationships(
  parsedRelationships: ParsedDBML["relationships"],
  baseRelationships: Relationship[],
  tables: Table[],
): Relationship[] {
  const resolved = parsedRelationships
    .map((parsed) => {
      const endpoints = resolveEndpoints(parsed, tables);
      return endpoints ? { parsed, endpoints } : null;
    })
    .filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null,
    );

  const available = baseRelationships.slice();
  const take = (predicate: (rel: Relationship) => boolean) => {
    const index = available.findIndex(predicate);
    if (index === -1) return null;
    return available.splice(index, 1)[0];
  };

  return resolved.map(({ parsed, endpoints }) => {
    const signature = endpointSignature({ ...endpoints });
    const base =
      take((rel) => rel.name === parsed.name) ??
      take(
        (rel) => endpointSignature(normalizeRelationship(rel)) === signature,
      ) ??
      null;

    const fields: RelationshipFieldPair[] =
      base &&
      Array.isArray(base.fields) &&
      sameRelationshipFields(base.fields, endpoints.fields)
        ? base.fields
        : endpoints.fields;

    return {
      ...(base ?? {}),
      id: base?.id ?? createId(),
      name: parsed.name,
      startTableId: endpoints.startTableId,
      endTableId: endpoints.endTableId,
      fields,
      startFieldId: fields[0].startFieldId,
      endFieldId: fields[0].endFieldId,
      cardinality: parsed.cardinality,
      updateConstraint: parsed.updateConstraint,
      deleteConstraint: parsed.deleteConstraint,
    };
  });
}

/**
 * Turn parsed DBML parts into diagram entities.
 *
 * When `base` is given, the parsed content is merged into the existing
 * diagram so that ids, positions and unrelated tables are preserved.
 */
export function reconcileDBML(
  parsed: ParsedDBML,
  base: {
    tables?: Table[];
    relationships?: Relationship[];
    enums?: Enum[];
  } | null,
  database: DatabaseType,
): ReconciledDBML {
  const baseTables = base?.tables ?? [];
  const matched = matchByName(parsed.tables, baseTables, sharesFieldName);

  const tables = parsed.tables.map((parsedTable, i) => {
    const baseTable = matched.get(i);
    return baseTable
      ? mergeTable(parsedTable, baseTable, database)
      : createTable(parsedTable);
  });

  placeNewTables(tables);
  keepFieldlessTables(tables, baseTables);

  return {
    tables,
    relationships: reconcileRelationships(
      parsed.relationships,
      base?.relationships ?? [],
      tables,
    ),
    enums: reconcileEnums(parsed.enums, base?.enums ?? []),
  };
}
