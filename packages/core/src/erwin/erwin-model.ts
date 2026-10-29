/**
 * The shape the erwin reader hands to the importer (P7, spec section 16).
 *
 * The reader knows the erwin XML of ERWin 7 and the names the other versions
 * use for the same elements (Q17). It does not decide what a diagram is: it
 * reports what the file says, and marks the parts it could not read so the
 * importer can keep the position and say why (Q18).
 */
import type { XmlNode } from "./xml.ts";
import { attributeNamed, childNamed, childrenNamed, normalizeXmlName, textOf } from "./xml.ts";

export type ErwinSkipReason = "unknown-element" | "unparsable" | "unsupported" | "asymmetric";

/** One piece of the file the reader could not turn into a value (Q18). */
export interface ErwinSkip {
  /** Where in the file, e.g. "Entity[2]/Attribute[1]/FieldType". */
  path: string;
  /** The element or the attribute that was skipped. */
  sourceName: string;
  reason: ErwinSkipReason;
  /** What the reader wanted, in a sentence for the report. */
  detail?: string;
  /** The original text, kept so a person can fix the file by hand. */
  original?: string;
}

export interface ErwinTypeRef {
  name: string;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface ErwinAttribute {
  id: string;
  name: string;
  description?: string;
  /** The logical data type of the attribute, as the file names it. */
  typeName?: string;
  /** The id of the physical field it describes (section 3.5.1). */
  fieldId?: string;
  /** True when the file marks the attribute as part of the primary key. */
  primary?: boolean;
  /** True when the file marks the attribute as unique. */
  unique?: boolean;
}

export interface ErwinField {
  id: string;
  name: string;
  description?: string;
  type?: ErwinTypeRef;
  nullable?: boolean;
}

export interface ErwinEntity {
  id: string;
  /** The name the model speaks (`EntryName`). */
  logicalName: string;
  /** The name the database speaks (`TableName`). */
  physicalName: string;
  description?: string;
  comment?: string;
  attributes: ErwinAttribute[];
  fields: ErwinField[];
}

export interface ErwinDomain {
  id: string;
  name: string;
  typeName?: string;
  parentId?: string;
}

export interface ErwinRelationship {
  id: string;
  name?: string;
  parentId?: string;
  childId?: string;
  parentFieldId?: string;
  childFieldId?: string;
  cardinality?: string;
}

export interface ErwinDocument {
  /** The version the file announces, or "unknown" when it does not. */
  version: string;
  entities: ErwinEntity[];
  domains: ErwinDomain[];
  relationships: ErwinRelationship[];
  skipped: ErwinSkip[];
}

/** The names of an element, in every version the plan acknowledges (Q17). */
const ALIASES = {
  version: ["version", "Version", "ERWinVersion", "ModelVersion"],
  entity: ["Entity", "Table", "EntityNode", "TableNode"],
  attribute: ["Attribute", "EntityAttribute", "Column"],
  field: ["Field", "TableField", "FieldNode"],
  domain: ["Domain", "DomainNode"],
  relationship: ["Relationship", "RelationshipNode", "ForeignKey"],
} as const;

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Reads a number the file writes as a value or as an attribute. */
function numberOf(node: XmlNode, names: readonly string[], path: string, skipped: ErwinSkip[]): number | undefined {
  const raw = attributeNamed(node, names) ?? textOf(node, names);
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (!NUMERIC.test(trimmed)) {
    skipped.push({ path, sourceName: names[0]!, reason: "unparsable", detail: "a number was expected", original: trimmed });
    return undefined;
  }
  return Number(trimmed);
}

/** Reads the type of a field: `<FieldType Datatype="varchar2" length="50"/>`. */
function readFieldType(node: XmlNode | undefined, path: string, skipped: ErwinSkip[]): ErwinTypeRef | undefined {
  if (!node) return undefined;
  const name = attributeNamed(node, ["Datatype", "DataType", "TypeName", "Type"])
    ?? textOf(node, ["Name", "TypeName"])
    ?? node.text.trim();
  if (name.length === 0) {
    skipped.push({ path, sourceName: node.name, reason: "unparsable", detail: "the type of the field is empty" });
    return undefined;
  }
  const length = numberOf(node, ["length", "Length", "size", "Size"], `${path}/length`, skipped);
  const precision = numberOf(node, ["precision", "Precision"], `${path}/precision`, skipped);
  const scale = numberOf(node, ["scale", "Scale"], `${path}/scale`, skipped);
  return { name, length, precision, scale };
}

/** True when the node marks one of its attributes as set. */
function flagOf(node: XmlNode, names: readonly string[]): boolean {
  const raw = attributeNamed(node, names);
  if (raw === undefined) return false;
  return /^(true|yes|1|y)$/i.test(raw.trim());
}

function pathOf(parent: string, name: string, index: number): string {
  return `${parent}/${name}[${index}]`;
}

/** Reads one entity, with its logical attributes and its physical fields. */
function readEntity(node: XmlNode, index: number, skipped: ErwinSkip[]): ErwinEntity | undefined {
  const path = pathOf("Entity", node.name, index);
  const id = attributeNamed(node, ["EntryId", "EntityId", "id"]) ?? textOf(node, ["EntryId", "Id"]) ?? `entity_${index + 1}`;
  const logicalName = attributeNamed(node, ["EntryName", "LogicalName", "Name"]) ?? textOf(node, ["EntryName", "LogicalName"]) ?? "";
  const physicalName = attributeNamed(node, ["TableName", "PhysicalName"]) ?? textOf(node, ["TableName", "PhysicalName"]) ?? "";
  if (logicalName.length === 0 && physicalName.length === 0) {
    skipped.push({ path, sourceName: node.name, reason: "asymmetric", detail: "an entity without a name is not imported" });
    return undefined;
  }

  const attributes: ErwinAttribute[] = childrenNamed(node, ALIASES.attribute).map((child, at) => {
    const attributePath = pathOf(path, child.name, at);
    if (flagOf(child, ["unsupported"])) {
      skipped.push({ path: attributePath, sourceName: child.name, reason: "unsupported", detail: "the attribute is marked unsupported" });
    }
    return {
      id: attributeNamed(child, ["attributeid", "AttributeId", "id"]) ?? `attribute_${index}_${at + 1}`,
      name: attributeNamed(child, ["attributeName", "AttributeName", "Name"]) ?? child.text.trim(),
      description: attributeNamed(child, ["arributeDesc", "attributeDesc", "AttributeDesc", "Description"]),
      typeName: attributeNamed(child, ["attributetype", "attributeType", "AttributeType", "Datatype"]),
      fieldId: attributeNamed(child, ["fieldid", "FieldId", "FieldID"]),
      primary: flagOf(child, ["primaryKey", "PrimaryKey", "isPrimaryKey"]),
      unique: flagOf(child, ["unique", "Unique", "isUnique"]),
    };
  });

  const fields: ErwinField[] = childrenNamed(node, ALIASES.field).map((child, at) => {
    const fieldPath = pathOf(path, child.name, at);
    return {
      id: attributeNamed(child, ["fieldId", "FieldId", "FieldID", "id"]) ?? `field_${index}_${at + 1}`,
      name: attributeNamed(child, ["fieldName", "FieldName", "Name"]) ?? textOf(child, ["fieldName", "Name"]) ?? "",
      description: attributeNamed(child, ["Comment", "comment", "Description"]),
      type: readFieldType(childNamed(child, ["FieldType", "Type"]), `${fieldPath}/FieldType`, skipped),
      nullable: !flagOf(child, ["notNull", "NotNull", "isNotNull"]),
    };
  });

  // A logical attribute without a field, or the other way round, is the
  // asymmetry section 3.5.1 calls an exception (Q18).
  const attributeFieldIds = new Set(attributes.map((attribute) => attribute.fieldId).filter(Boolean));
  for (const field of fields) {
    if (attributeFieldIds.size > 0 && !attributeFieldIds.has(field.id)) {
      skipped.push({ path, sourceName: field.name, reason: "asymmetric", detail: `the field "${field.name}" has no logical attribute` });
    }
  }

  return {
    id,
    logicalName: logicalName.length > 0 ? logicalName : physicalName,
    physicalName: physicalName.length > 0 ? physicalName : logicalName,
    description: attributeNamed(node, ["EntryDesc", "EntityDesc", "Description"]),
    comment: attributeNamed(node, ["comment", "Comment", "TableComment"]),
    attributes,
    fields,
  };
}

/** Reads the erwin document into the plain shape the importer maps (Q17). */
export function readErwinDocument(root: XmlNode): ErwinDocument {
  const skipped: ErwinSkip[] = [];
  const version = attributeNamed(root, ALIASES.version)
    ?? textOf(root, ALIASES.version)
    ?? "unknown";

  const entities = childrenNamed(root, ALIASES.entity)
    .map((node, index) => readEntity(node, index, skipped))
    .filter((entity): entity is ErwinEntity => entity !== undefined);

  const domains: ErwinDomain[] = childrenNamed(root, ALIASES.domain).map((node, index) => ({
    id: attributeNamed(node, ["DomainId", "id"]) ?? `domain_${index + 1}`,
    name: attributeNamed(node, ["DomainName", "Name"]) ?? textOf(node, ["DomainName", "Name"]) ?? "",
    typeName: attributeNamed(node, ["Datatype", "Type", "TypeName"]),
    parentId: attributeNamed(node, ["ParentId", "parentId"]),
  })).filter((domain) => domain.name.length > 0);

  const relationships: ErwinRelationship[] = childrenNamed(root, ALIASES.relationship).map((node, index) => ({
    id: attributeNamed(node, ["RelationshipId", "id"]) ?? `relationship_${index + 1}`,
    name: attributeNamed(node, ["RelationshipName", "Name", "FKName"]),
    parentId: attributeNamed(node, ["ParentEntityId", "ParentId", "parentId"]),
    childId: attributeNamed(node, ["ChildEntityId", "ChildId", "childId"]),
    parentFieldId: attributeNamed(node, ["ParentFieldId", "ParentFieldID"]),
    childFieldId: attributeNamed(node, ["ChildFieldId", "ChildFieldID"]),
    cardinality: attributeNamed(node, ["Cardinality", "cardinality"]),
  }));

  // Everything else is reported rather than dropped silently.
  const known = new Set(
    [ALIASES.entity, ALIASES.domain, ALIASES.relationship, ["Version", "version"]].flat().map(normalizeXmlName),
  );
  for (const child of root.children) {
    if (!known.has(normalizeXmlName(child.name))) {
      skipped.push({
        path: child.name,
        sourceName: child.name,
        reason: "unknown-element",
        detail: "the element is not part of the erwin schema the importer knows",
      });
    }
  }

  return { version, entities, domains, relationships, skipped };
}
