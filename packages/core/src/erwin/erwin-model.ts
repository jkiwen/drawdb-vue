/**
 * The erwin document model of P7, read in one pass (spec section 16).
 *
 * The importer reads the XML Standard File of ERwin 7 (the sample is
 * 7.3.1822). The file is large on purpose-built models (hundreds of tables),
 * so the reader never builds a tree of the whole document: it slices the
 * elements it wants out of the text and parses each slice on its own. What it
 * could not read is recorded as a skip, not thrown away (Q18).
 */
import type { XmlNode } from "./xml.ts";
import { attributeNamed, childNamed, childrenNamed, descendantsNamed, parseXml, scanElements, textOf } from "./xml.ts";

export type ErwinSkipReason = "unknown-element" | "unparsable" | "unsupported" | "asymmetric";

/** One piece of the file the reader could not turn into a value (Q18). */
export interface ErwinSkip {
  /** Where in the file, e.g. "Entity[2]/Attribute[1]". */
  path: string;
  /** The element or the attribute that was skipped. */
  sourceName: string;
  reason: ErwinSkipReason;
  /** What the reader wanted, in a sentence for the report. */
  detail?: string;
  /** The original text, kept so a person can fix the file by hand. */
  original?: string;
}

/** A data type as erwin writes it, e.g. `VARCHAR2(32)` or `NUMBER(10,2)`. */
export interface ErwinTypeRef {
  /** The base name, as written: `VARCHAR2`, `NUMBER`, `DATE`. */
  name: string;
  /** The raw text the file has, kept for the report. */
  raw?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface ErwinAttribute {
  id: string;
  /** The logical name (`Name`). */
  name: string;
  /** The physical name (`Physical_Name`). */
  physicalName: string;
  comment?: string;
  logicalType?: ErwinTypeRef;
  physicalType?: ErwinTypeRef;
  /** True when the file says the column is NOT NULL. */
  notNull?: boolean;
  /** The domain the attribute is typed by (`Parent_Domain_Ref`). */
  domainId?: string;
}

export interface ErwinEntity {
  id: string;
  /** The logical name (`Name`). */
  name: string;
  /** The physical name (`Physical_Name`). */
  physicalName: string;
  comment?: string;
  definition?: string;
  attributes: ErwinAttribute[];
}

export interface ErwinDomain {
  id: string;
  name: string;
  builtInId?: string;
  physicalName?: string;
  logicalType?: ErwinTypeRef;
  /** How the model's own database spells the type (erwin's physical name). */
  physicalType?: ErwinTypeRef;
  parentId?: string;
}

export type ErwinKeyKind = "primary" | "unique" | "foreign" | "index" | "other";

export interface ErwinKeyGroup {
  id: string;
  name: string;
  kind: ErwinKeyKind;
  /** The raw `Key_Group_Type`: PK, AK, FK, IE… */
  type: string;
  physicalName?: string;
  constraintName?: string;
  unique?: boolean;
  /** The columns the key is made of, in file order. */
  members: ErwinKeyMember[];
}

/** One column of a key: the attribute it points at and its sort order. */
export interface ErwinKeyMember {
  /** The attribute the member points at (`Attribute_Ref`). */
  attributeId: string;
  order?: "asc" | "desc";
}

export interface ErwinRelationship {
  id: string;
  name: string;
  physicalName?: string;
  /** The raw `Cardinality` code the file states. */
  cardinality?: string;
  parentEntityId?: string;
  childEntityId?: string;
  keyGroupId?: string;
}

export interface ErwinDocument {
  /** The `FileVersion` of the root element, e.g. "7.3.1822". */
  version: string;
  entities: ErwinEntity[];
  domains: ErwinDomain[];
  keyGroups: ErwinKeyGroup[];
  relationships: ErwinRelationship[];
  skipped: ErwinSkip[];
}

/** Splits `VARCHAR2(32)` or `NUMBER(10,2)` into the base name and its numbers. */
export function readDataType(raw: string | undefined): ErwinTypeRef | undefined {
  if (raw === undefined) return undefined;
  const text = raw.trim();
  if (text.length === 0) return undefined;
  const match = /^([^()]+?)\s*(?:\(([^)]*)\))?$/.exec(text);
  if (!match) return { name: text, raw: text };
  const base = match[1]!.trim();
  const numbers = (match[2] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  const sized = /char|binary|bit|text|raw|blob|clob|nvarchar|varchar/i.test(base);
  const numeric = /decimal|numeric|number|float|double|real/i.test(base);
  if (numbers.length === 0 || numbers.some((value) => Number.isNaN(value))) {
    return { name: base, raw: text };
  }
  if (numeric) {
    return { name: base, raw: text, precision: numbers[0], scale: numbers[1] };
  }
  if (sized) {
    return { name: base, raw: text, length: numbers[0] };
  }
  return { name: base, raw: text, length: numbers[0] };
}

/** The properties bag of an element (`<EntityProps>` inside `<Entity>`). */
function propsOf(node: XmlNode, name: string): XmlNode {
  return childNamed(node, [`${name}Props`, name]) ?? node;
}

function keyKindOf(type: string): ErwinKeyKind {
  const upper = type.trim().toUpperCase();
  if (upper === "PK") return "primary";
  if (upper === "AK" || upper === "UK") return "unique";
  if (upper === "FK") return "foreign";
  // IE is erwin's unique index; IF1/IF2 are the indexes it adds for a
  // foreign key, which are indexes and not constraints.
  if (upper === "IE") return "unique";
  if (/^IF\d*$/.test(upper)) return "index";
  return "other";
}

function readAttribute(node: XmlNode, where: string, skipped: ErwinSkip[]): ErwinAttribute {
  const props = propsOf(node, node.name);
  const name = textOf(props, ["Name"]) ?? attributeNamed(node, ["name"]) ?? "";
  const physicalName = textOf(props, ["Physical_Name"]) ?? name;
  const logicalType = readDataType(textOf(props, ["Logical_Data_Type"]));
  const physicalType = readDataType(textOf(props, ["Physical_Data_Type"]));
  if (physicalType === undefined) {
    skipped.push({ path: where, sourceName: name, reason: "asymmetric", detail: "the column has no physical data type" });
  }
  return {
    id: attributeNamed(node, ["id"]) ?? name,
    name,
    physicalName,
    comment: textOf(props, ["Comment"]),
    logicalType,
    physicalType,
    notNull: textOf(props, ["Null_Option_Type"]) === "1" || undefined,
    domainId: textOf(props, ["Parent_Domain_Ref"]),
  };
}

function readEntity(node: XmlNode, index: number, skipped: ErwinSkip[]): { entity: ErwinEntity; keys: ErwinKeyGroup[] } {
  const props = propsOf(node, "Entity");
  const name = textOf(props, ["Name"]) ?? attributeNamed(node, ["name"]) ?? "";
  const physicalName = textOf(props, ["Physical_Name"]) ?? name;
  const where = `Entity[${index}]`;
  // The attributes of an entity sit inside its attribute groups.
  const attributes = descendantsNamed(node, ["Attribute", "Column"]).map((child, at) =>
    readAttribute(child, `${where}/Attribute[${at}]`, skipped),
  );
  if (attributes.length === 0) {
    skipped.push({ path: where, sourceName: name, reason: "asymmetric", detail: "the entity has no attributes" });
  }
  // The key groups of an entity live inside the entity element as well.
  const keys = descendantsNamed(node, ["Key_Group"]).map((child, at) => readKeyGroup(child, at, skipped));
  return {
    entity: {
      id: attributeNamed(node, ["id"]) ?? name,
      name,
      physicalName,
      comment: textOf(props, ["Comment"]),
      definition: textOf(props, ["Definition"]),
      attributes,
    },
    keys,
  };
}

function readDomain(node: XmlNode, index: number, skipped: ErwinSkip[]): ErwinDomain {
  const props = propsOf(node, "Domain");
  const name = textOf(props, ["Name"]) ?? attributeNamed(node, ["name"]) ?? "";
  const where = `Domain[${index}]`;
  const logicalType = readDataType(textOf(props, ["Logical_Data_Type"]) ?? textOf(props, ["Physical_Data_Type"]));
  if (logicalType === undefined) {
    skipped.push({ path: where, sourceName: name, reason: "asymmetric", detail: "the domain has no data type" });
  }
  return {
    id: attributeNamed(node, ["id"]) ?? name,
    name,
    builtInId: textOf(props, ["Built_In_Id"]),
    physicalName: textOf(props, ["Physical_Name"]),
    logicalType,
    physicalType: readDataType(textOf(props, ["Physical_Data_Type"])),
    parentId: textOf(props, ["Parent_Domain_Ref"]),
  };
}

function readKeyGroup(node: XmlNode, index: number, skipped: ErwinSkip[]): ErwinKeyGroup {
  const props = propsOf(node, "Key_Group");
  const type = textOf(props, ["Key_Group_Type"]) ?? "";
  const kind = keyKindOf(type);
  const name = textOf(props, ["Name"]) ?? attributeNamed(node, ["name"]) ?? "";
  // The order-ref array names member objects, and each member object points
  // at the attribute it stands for; the member's sort order comes along.
  const memberList = childNamed(props, ["Key_Group_Members_Order_Ref_Array"]) ?? props;
  const memberRefs = childrenNamed(memberList, ["Key_Group_Members_Order_Ref"])
    .map((child) => child.text.trim())
    .filter((value) => value.length > 0);
  const memberById = new Map<string, ErwinKeyMember>();
  for (const memberNode of descendantsNamed(node, ["Key_Group_Member"])) {
    const memberProps = propsOf(memberNode, "Key_Group_Member");
    const id = attributeNamed(memberNode, ["id"]) ?? "";
    const attributeId = textOf(memberProps, ["Attribute_Ref"]);
    if (id.length === 0 || attributeId === undefined) continue;
    const order = textOf(memberProps, ["Key_Group_Sort_Order"])?.toLowerCase();
    memberById.set(id, { attributeId, ...(order === "desc" ? { order: "desc" as const } : order === "asc" ? { order: "asc" as const } : {}) });
  }
  const members: ErwinKeyMember[] = [];
  for (const ref of memberRefs) {
    const member = memberById.get(ref);
    if (member) members.push(member);
    else skipped.push({ path: `Key_Group[${index}]`, sourceName: name, reason: "asymmetric", detail: `the key names a member the file does not have: ${ref}` });
  }
  if (kind === "other") {
    skipped.push({ path: `Key_Group[${index}]`, sourceName: name, reason: "unsupported", detail: `the key type "${type}" is not imported` });
  }
  return {
    id: attributeNamed(node, ["id"]) ?? name,
    name,
    kind,
    type,
    physicalName: textOf(props, ["Physical_Name"]),
    constraintName: textOf(props, ["Constraint_Name"]),
    unique: textOf(props, ["Is_Unique"]) === "true" || undefined,
    members,
  };
}

function readRelationship(node: XmlNode): ErwinRelationship {
  const props = propsOf(node, "Relationship");
  const name = textOf(props, ["Name"]) ?? attributeNamed(node, ["name"]) ?? "";
  return {
    id: attributeNamed(node, ["id"]) ?? name,
    name,
    physicalName: textOf(props, ["Physical_Name"]),
    cardinality: textOf(props, ["Cardinality"]),
    parentEntityId: textOf(props, ["Parent_Entity_Ref"]),
    childEntityId: textOf(props, ["Child_Entity_Ref"]),
    keyGroupId: textOf(props, ["Key_Group_Ref"]),
  };
}

/** The `FileVersion` of the root element, read without parsing the document. */
export function readErwinVersion(source: string): string {
  // The file starts with a prolog (`<?xml …?>`); the root element comes after
  // it, so the first tag that is neither a prolog nor a declaration is used.
  let at = source.indexOf("<");
  while (at >= 0 && (source[at + 1] === "?" || source[at + 1] === "!")) {
    at = source.indexOf("<", source.indexOf(">", at) + 1);
  }
  if (at < 0) return "unknown";
  const end = source.indexOf(">", at);
  if (end < 0) return "unknown";
  const head = parseXml(source.slice(at, end + 1));
  return attributeNamed(head, ["FileVersion", "Version"]) ?? "unknown";
}

const IMPORTED_ELEMENTS = ["Entity", "Domain", "Key_Group", "Relationship"] as const;

/**
 * Reads the document in one pass: every interesting element is sliced out and
 * parsed on its own, so memory follows one element rather than the file.
 */
export function readErwinDocument(source: string): ErwinDocument {
  const skipped: ErwinSkip[] = [];
  const document: ErwinDocument = {
    version: readErwinVersion(source),
    entities: [],
    domains: [],
    keyGroups: [],
    relationships: [],
    skipped,
  };

  let entityCount = 0;
  let domainCount = 0;
  let keyCount = 0;
  scanElements(source, IMPORTED_ELEMENTS, (name, slice) => {
    const node = parseXml(slice);
    const normalized = name.replace(/^[^:]+:/, "");
    if (normalized === "Entity") {
      const read = readEntity(node, entityCount++, skipped);
      document.entities.push(read.entity);
      document.keyGroups.push(...read.keys);
    }
    else if (normalized === "Domain") document.domains.push(readDomain(node, domainCount++, skipped));
    else if (normalized === "Key_Group") document.keyGroups.push(readKeyGroup(node, keyCount++, skipped));
    else document.relationships.push(readRelationship(node));
  });

  return document;
}
