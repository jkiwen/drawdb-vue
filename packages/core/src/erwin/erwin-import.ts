/**
 * Maps an erwin document onto a diagram (P7, spec section 16).
 *
 * The mapping is deliberately plain: a table keeps the physical name and the
 * logical entity keeps the model name (section 2), the physical type is the
 * one the file states and it is marked `imported` so a reader never mistakes
 * it for a mapping the type system computed (Q8), and every part the reader
 * skipped becomes an invalid marker on the object that would have held it
 * (Q18).
 *
 * The file of the review sample (ERwin 7.3.1822) keeps the keys in
 * `Key_Group` elements whose members are attribute ids, and it keeps the
 * relationships in `Relationship` elements that point at a key group and at
 * the two entities. Both are read here; nothing is inferred from names.
 */
import type {
  DatabaseType,
  Diagram,
  Index,
  LogicalAttribute,
  LogicalDomain,
  LogicalEntity,
  LogicalTypeRef,
  PhysicalField,
  PrimaryKey,
  Relationship,
  Table,
  UniqueKey,
} from "../models/index.ts";
import type { InvalidMarker } from "../models/invalid-marker.ts";
import { createEmptyDiagram } from "../models/diagram.ts";
import { normalizeDiagramKeys } from "../models/key-migration.ts";
import { nextKeyName } from "../models/key-names.ts";
import type {
  ErwinAttribute,
  ErwinDocument,
  ErwinDomain,
  ErwinEntity,
  ErwinKeyGroup,
  ErwinSkip,
  ErwinTypeRef,
} from "./erwin-model.ts";
import { readErwinDocument } from "./erwin-model.ts";

/** What the import did, in the numbers a report shows. */
export interface ErwinImportReport {
  version: string;
  entities: number;
  attributes: number;
  fields: number;
  domains: number;
  relationships: number;
  /** The key groups the file stated, whatever their kind. */
  keys: number;
  /** Everything the reader could not turn into a value, in file order. */
  skipped: ErwinSkip[];
  markers: InvalidMarker[];
  /** One sentence per decision the user may want to check. */
  notes: string[];
}

export interface ErwinImportResult {
  diagram: Diagram;
  report: ErwinImportReport;
}

export interface ErwinImportOptions {
  /** The dialect the imported physical types are read as; erwin is usually mssql. */
  database?: DatabaseType;
  /** The title of the diagram, when the caller knows a better one than the file. */
  title?: string;
}

const COLUMN_GAP = 320;
const ROW_GAP = 300;
const ORIGIN = { x: 80, y: 80 };
const COLUMNS = 3;

/** The logical family an erwin type name belongs to (section 3.2 families). */
const FAMILY_BY_TYPE: ReadonlyArray<[RegExp, string]> = [
  [/^(tiny|small|medium|big)?\s*int(eger)?|^int[248]$|^serial|^long/i, "integer"],
  [/^(decimal|numeric|number|money|smallmoney)/i, "decimal"],
  [/^(float|double|real)/i, "float"],
  [/^(varchar|nvarchar|varchar2|nvarchar2|char|nchar|text|ntext|clob|nclob|string|long)/i, "string"],
  [/^date$/i, "date"],
  [/^(datetime|timestamp|timestamptz|datetime2|smalldatetime)/i, "datetime"],
  [/^(binary|varbinary|raw|image|bytea|bit varying)/i, "binary"],
  [/^(bool|boolean|bit)/i, "boolean"],
  [/^(uuid|uniqueidentifier)/i, "uuid"],
  [/^(json|jsonb)/i, "json"],
];

/** The family of a type name, or `common` when the file names something else. */
export function familyOfType(typeName: string | undefined): string {
  if (!typeName) return "string";
  for (const [pattern, family] of FAMILY_BY_TYPE) {
    if (pattern.test(typeName.trim())) return family;
  }
  return "common";
}

/** The logical type of an erwin type reference, with the numbers it states. */
function logicalTypeOf(type: ErwinTypeRef | undefined): LogicalTypeRef {
  const family = familyOfType(type?.name);
  if (type?.length !== undefined && (family === "string" || family === "binary")) {
    return { family, params: { length: type.length } } as LogicalTypeRef;
  }
  if (type?.precision !== undefined && family === "decimal") {
    const scale = type.scale;
    return { family, params: { precision: type.precision, ...(scale === undefined ? {} : { scale }) } } as LogicalTypeRef;
  }
  return { family } as LogicalTypeRef;
}

function positionOf(index: number): { x: number; y: number } {
  return {
    x: ORIGIN.x + (index % COLUMNS) * COLUMN_GAP,
    y: ORIGIN.y + Math.floor(index / COLUMNS) * ROW_GAP,
  };
}

function physicalOf(attribute: ErwinAttribute): PhysicalField {
  const type = attribute.physicalType ?? attribute.logicalType;
  const notNull = attribute.notNull === true;
  return {
    id: attribute.id,
    name: attribute.physicalName || attribute.name,
    fieldType: {
      type: type?.name ?? "",
      ...(type?.length === undefined ? {} : { length: type.length }),
      ...(type?.precision === undefined ? {} : { precision: type.precision }),
      ...(type?.scale === undefined ? {} : { scale: type.scale }),
    },
    fieldTypeSource: "imported",
    ...(attribute.comment === undefined ? {} : { comment: attribute.comment }),
    ...(notNull ? { nullable: false, notNull: true } : {}),
  };
}

/** erwin's own domain categories: the model inherits them, it does not declare them. */
const ERWIN_BUILT_IN_DOMAINS = new Set(["<root>", "<default>", "String", "Number", "Datetime", "Blob"]);

/** The parameters a type reference states, in the terms of the family. */
function paramsOf(type: ErwinTypeRef | undefined, family: string): { length?: number; precision?: number; scale?: number } | undefined {
  if (type === undefined) return undefined;
  if (type.length !== undefined && (family === "string" || family === "text" || family === "binary")) {
    return { length: type.length };
  }
  if (type.precision !== undefined) {
    return type.scale === undefined ? { precision: type.precision } : { precision: type.precision, scale: type.scale };
  }
  return undefined;
}

/**
 * The custom logical types of the model: erwin keeps a user-defined domain as a
 * `Domain` element without a `Built_In_Id`, derived from a parent domain and
 * spelling the same type for the logical and the physical model (for example
 * `INT-4`, an `INT` with four bytes). They belong to the diagram, so they are
 * read into `diagram.domains` and the attributes that name one point at it
 * (review ruling, 2026-10-30).
 */
function domainsOf(
  document: ErwinDocument,
  database: DatabaseType,
): { domains: LogicalDomain[]; idOf: Map<string, string> } {
  const idOf = new Map<string, string>();
  const read: { domain: LogicalDomain; erwinId: string; parentErwinId?: string }[] = [];
  for (const source of document.domains) {
    if (isErwinBuiltInDomain(source)) continue;
    const id = `domain_${source.id}`;
    const family = familyOfType(source.logicalType?.name ?? source.physicalType?.name);
    const params = paramsOf(source.logicalType, family);
    const physicalType = source.physicalType;
    const physicalParams = paramsOf(physicalType, family);
    idOf.set(source.id, id);
    read.push({
      erwinId: source.id,
      parentErwinId: source.parentId,
      domain: {
        id,
        name: source.name,
        family,
        ...(params === undefined ? {} : { params }),
        ...(physicalType === undefined
          ? {}
          : { physical: { [database]: { type: physicalType.name, ...(physicalParams ?? {}) } } }),
      },
    });
  }
  // A custom type may derive from another one; the link is kept (Q13) but the
  // resolver does not inherit through it.
  for (const entry of read) {
    const parent = entry.parentErwinId === undefined ? undefined : idOf.get(entry.parentErwinId);
    if (parent !== undefined) entry.domain.parentId = parent;
  }
  return { domains: read.map((entry) => entry.domain), idOf };
}

/** erwin keeps its six categories in `Built_In_Id` 1..6; 0 is the model's own. */
function isErwinBuiltInDomain(domain: ErwinDomain): boolean {
  if (domain.name === "" || ERWIN_BUILT_IN_DOMAINS.has(domain.name)) return true;
  return domain.builtInId !== undefined && /^[1-6]$/.test(domain.builtInId.trim());
}

function columnsOf(key: ErwinKeyGroup): { fieldId: string; order?: "asc" | "desc" }[] {
  return key.members.map((member) => ({
    fieldId: member.attributeId,
    ...(member.order === undefined ? {} : { order: member.order }),
  }));
}

function primaryKeyOf(keys: ErwinKeyGroup[], tableName: string, logicalName: string): PrimaryKey | undefined {
  const group = keys.find((key) => key.kind === "primary");
  if (!group) return undefined;
  const taken: string[] = [];
  return {
    id: `pk_${group.id}`,
    logicalName: group.name || nextKeyName("primary", logicalName, undefined, taken),
    name: group.constraintName || group.physicalName || group.name || nextKeyName("primary", tableName, undefined, taken),
    columns: columnsOf(group),
  };
}

function uniqueKeysOf(keys: ErwinKeyGroup[], tableName: string, logicalName: string): UniqueKey[] {
  const taken: string[] = [];
  return keys
    .filter((key) => key.kind === "unique")
    .map((group) => ({
      id: `uk_${group.id}`,
      logicalName: group.name || nextKeyName("unique", logicalName, undefined, taken),
      name: group.constraintName || group.physicalName || group.name || nextKeyName("unique", tableName, undefined, taken),
      columns: columnsOf(group),
    }));
}

function indexesOf(keys: ErwinKeyGroup[], tableName: string, logicalName: string): Index[] {
  const taken: string[] = [];
  return keys
    .filter((key) => key.kind === "index")
    .map((group) => ({
      id: `idx_${group.id}`,
      logicalName: nextKeyName("index", logicalName, undefined, taken),
      name: group.constraintName || group.physicalName || group.name || nextKeyName("index", tableName, undefined, taken),
      unique: group.unique === true,
      columns: columnsOf(group),
    }));
}

/** Reads one entity into a table with its logical entity and its fields. */
function tableOf(
  entity: ErwinEntity,
  index: number,
  keys: ErwinKeyGroup[],
  report: ErwinImportReport,
  domainOf: Map<string, string>,
): Table {
  const fields = entity.attributes.map(physicalOf);
  const fieldById = new Map(fields.map((field) => [String(field.id), field]));

  const primaryMembers = new Set((keys.find((key) => key.kind === "primary")?.members ?? []).map((member) => member.attributeId));
  const uniqueMembers = new Set(keys.filter((key) => key.kind === "unique").flatMap((key) => key.members.map((member) => member.attributeId)));

  const attributes: LogicalAttribute[] = entity.attributes.map((attribute) => {
    const paired = fieldById.get(String(attribute.id));
    if (!paired) {
      report.skipped.push({
        path: `Entity[${index}]/Attribute`,
        sourceName: attribute.name,
        reason: "asymmetric",
        detail: `the attribute "${attribute.name}" has no column of its own`,
      });
    }
    const keyRole = primaryMembers.has(attribute.id) ? "primary" : uniqueMembers.has(attribute.id) ? "alternate" : undefined;
    const domainId = attribute.domainId === undefined ? undefined : domainOf.get(attribute.domainId);
    return {
      id: attribute.id,
      name: attribute.name || attribute.physicalName,
      ...(attribute.comment === undefined ? {} : { description: attribute.comment }),
      logicalType: domainId === undefined ? logicalTypeOf(attribute.logicalType) : { domainId },
      fieldId: attribute.id,
      ...(keyRole === undefined ? {} : { keyRole }),
      ...(attribute.notNull ? { required: true } : {}),
    } as LogicalAttribute;
  });

  const tableName = entity.physicalName || entity.name;
  const logicalName = entity.name || entity.physicalName;
  const logical: LogicalEntity = {
    id: `l_${entity.id}`,
    name: logicalName,
    ...(entity.comment === undefined && entity.definition === undefined
      ? {}
      : { description: entity.comment ?? entity.definition }),
    attributes,
  };

  const { x, y } = positionOf(index);
  const primaryKey = primaryKeyOf(keys, tableName, logicalName);
  const uniqueKeys = uniqueKeysOf(keys, tableName, logicalName);
  const indices = indexesOf(keys, tableName, logicalName);
  return {
    id: entity.id,
    name: tableName,
    logical,
    fields,
    ...(primaryKey === undefined ? {} : { primaryKey }),
    ...(uniqueKeys.length === 0 ? {} : { uniqueKeys }),
    ...(indices.length === 0 ? {} : { indices }),
    x,
    y,
    ...(entity.comment === undefined ? {} : { comment: entity.comment }),
  };
}

/** Reads the relationships the file states between the entities it imported. */
function relationshipsOf(document: ErwinDocument, tables: Table[], report: ErwinImportReport): Relationship[] {
  const byId = new Map(tables.map((table) => [String(table.id), table]));
  const keyById = new Map(document.keyGroups.map((key) => [key.id, key]));
  const relationships: Relationship[] = [];
  for (const [index, source] of document.relationships.entries()) {
    const parent = source.parentEntityId ? byId.get(source.parentEntityId) : undefined;
    const child = source.childEntityId ? byId.get(source.childEntityId) : undefined;
    if (!parent || !child) {
      report.skipped.push({
        path: `Relationship[${index}]`,
        sourceName: source.name || source.id,
        reason: "asymmetric",
        detail: "the relationship names an entity the file does not have",
      });
      continue;
    }
    const keyGroup = source.keyGroupId ? keyById.get(source.keyGroupId) : undefined;
    const childColumns = (keyGroup?.members ?? []).map((member) => member.attributeId);
    const parentColumns = (parent.primaryKey?.columns ?? []).map((column) => String(column.fieldId));
    const pairs = (childColumns.length > 0 ? childColumns : [child.fields[0]?.id]).map((startFieldId, at) => ({
      startFieldId: startFieldId ?? "",
      endFieldId: parentColumns[at] ?? parentColumns[0] ?? parent.fields[0]?.id ?? "",
    }));
    const usable = pairs.filter((pair) => pair.startFieldId !== "" && pair.endFieldId !== "");
    if (usable.length === 0) {
      report.skipped.push({
        path: `Relationship[${index}]`,
        sourceName: source.name || source.id,
        reason: "asymmetric",
        detail: "the relationship names no column to connect",
      });
      continue;
    }
    relationships.push({
      id: source.id,
      name: source.physicalName || source.name || `fk_${child.name}_${parent.name}`,
      startTableId: child.id,
      startFieldId: usable[0]!.startFieldId,
      endTableId: parent.id,
      endFieldId: usable[0]!.endFieldId,
      fields: usable,
    });
  }
  return relationships;
}

function markersOf(document: ErwinDocument, ownerOf: (skip: ErwinSkip) => string): InvalidMarker[] {
  return document.skipped.map((skip) => ({
    ownerId: ownerOf(skip),
    path: skip.path,
    sourceName: skip.sourceName,
    reason: skip.reason,
    original: skip.original ?? skip.detail,
  }));
}

/** Reads an erwin XML Standard File into a diagram and the report of it. */
export function importErwinXml(source: string, options: ErwinImportOptions = {}): ErwinImportResult {
  const document = readErwinDocument(source);
  const report: ErwinImportReport = {
    version: document.version,
    entities: document.entities.length,
    attributes: document.entities.reduce((total, entity) => total + entity.attributes.length, 0),
    fields: document.entities.reduce((total, entity) => total + entity.attributes.length, 0),
    domains: document.domains.length,
    relationships: document.relationships.length,
    keys: document.keyGroups.length,
    skipped: document.skipped,
    markers: [],
    notes: [],
  };

  // The keys of an entity are the key groups whose members are its attributes.
  const entityOfAttribute = new Map<string, string>();
  for (const entity of document.entities) {
    for (const attribute of entity.attributes) entityOfAttribute.set(attribute.id, entity.id);
  }
  const keysOfEntity = new Map<string, ErwinKeyGroup[]>();
  for (const key of document.keyGroups) {
    const owner = key.members.map((member) => entityOfAttribute.get(member.attributeId)).find((id) => id !== undefined);
    if (!owner) {
      report.skipped.push({
        path: `Key_Group[${key.name}]`,
        sourceName: key.name,
        reason: "asymmetric",
        detail: "the key group names no attribute of the imported entities",
      });
      continue;
    }
    const list = keysOfEntity.get(owner) ?? [];
    list.push(key);
    keysOfEntity.set(owner, list);
  }

  const database = options.database ?? "mssql";
  const { domains, idOf: domainIdOf } = domainsOf(document, database);
  const tables: Table[] = document.entities.map((entity, index) =>
    tableOf(entity, index, keysOfEntity.get(entity.id) ?? [], report, domainIdOf),
  );
  const relationships = relationshipsOf(document, tables, report);

  // A foreign key is the child side of a relationship (invariant INV-10 keeps
  // the two in step; the file states the relationship, so it is the anchor).
  const tableById = new Map(tables.map((table) => [String(table.id), table]));
  for (const relationship of relationships) {
    const child = tableById.get(String(relationship.startTableId));
    if (!child) continue;
    const foreignKeys = child.foreignKeys ?? [];
    foreignKeys.push({
      id: `fk_${relationship.id}`,
      logicalName: relationship.name ?? `fk_${relationship.id}`,
      name: relationship.name ?? `fk_${relationship.id}`,
      relationshipId: String(relationship.id),
    });
    child.foreignKeys = foreignKeys;
  }

  const logicalRelationships = document.relationships.map((source) => ({
    id: source.id,
    name: source.name,
  }));

  const diagram: Diagram = {
    ...createEmptyDiagram(),
    database,
    title: options.title ?? "Imported from erwin",
    tables,
    relationships,
    logicalRelationships,
    ...(domains.length === 0 ? {} : { domains }),
  };

  report.markers = markersOf(document, (skip) => {
    const entityIndex = /^Entity\[(\d+)\]/.exec(skip.path);
    const entity = entityIndex ? document.entities[Number(entityIndex[1])] : undefined;
    return entity?.id ?? diagram.id ?? "diagram";
  });
  diagram.invalidMarkers = report.markers;

  const inherited = document.domains.length - domains.length;
  if (domains.length > 0) {
    report.notes.push(`${domains.length} custom logical types are part of the diagram.`);
  }
  if (inherited > 0) {
    report.notes.push(`${inherited} of the domains the file carries are erwin's own categories and are not repeated on the diagram.`);
  }
  const unsupportedKeys = document.keyGroups.filter((key) => key.kind === "other").length;
  if (unsupportedKeys > 0) {
    report.notes.push(`${unsupportedKeys} key groups have a type the import does not map and were skipped.`);
  }
  const unknownFamilies = tables
    .flatMap((table) => table.logical.attributes)
    .filter((attribute) => attribute.logicalType && "family" in attribute.logicalType && attribute.logicalType.family === "common");
  if (unknownFamilies.length > 0) {
    report.notes.push(`${unknownFamilies.length} logical types have no family of their own and were read as common.`);
  }

  return { diagram: normalizeDiagramKeys(diagram), report };
}
