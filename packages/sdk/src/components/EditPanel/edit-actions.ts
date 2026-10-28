import { BUILTIN_FAMILIES, FALLBACK_TYPE, createId } from "@drawdb/core";
import type {
  Field,
  FieldId,
  LogicalRelationship,
  PhysicalSpec,
  Relationship,
  Table,
} from "@drawdb/core";
import type { useDiagramStore } from "../../stores/diagram.ts";
import type { FieldPairRow } from "./edit-panel-model.ts";
import { suggestPhysicalSpec } from "./edit-panel-model.ts";

/**
 * The commit helpers of the edit panel. Every helper takes the diagram
 * store, applies the commit rules the design fixes for this panel (trim,
 * empty does nothing, an unchanged value does nothing — design section
 * 4.4), and delegates to the store commands so undo and the lock rules
 * keep working.
 */

type DiagramStore = ReturnType<typeof useDiagramStore>;

/** The table-level edits of the basics group (design section 4.3). */
export interface TableBasicsPatch {
  physicalName?: string;
  logicalName?: string;
  description?: string;
  comment?: string;
}

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function commitTableBasics(
  store: DiagramStore,
  table: Table,
  patch: TableBasicsPatch,
): void {
  const physicalName = patch.physicalName?.trim();
  if (physicalName !== undefined && physicalName !== "" && physicalName !== table.name) {
    store.updateTable(table.id, { name: physicalName });
  }
  const logicalName = patch.logicalName?.trim();
  if (logicalName !== undefined && logicalName !== "" && logicalName !== table.logical.name) {
    store.updateTable(table.id, {
      logical: { ...table.logical, name: logicalName },
    });
  }
  if (patch.description !== undefined) {
    const description = clean(patch.description);
    if (description !== table.logical.description) {
      store.updateTable(table.id, {
        logical: { ...table.logical, description },
      });
    }
  }
  if (patch.comment !== undefined) {
    const comment = clean(patch.comment);
    if (comment !== table.comment) {
      store.updateTable(table.id, { comment });
    }
  }
}

/** Renames the logical attribute of a row through the whole logical entity. */
export function commitLogicalName(
  store: DiagramStore,
  table: Table,
  attributeId: string,
  value: string,
): void {
  const name = value.trim();
  const attribute = table.logical.attributes.find((a) => a.id === attributeId);
  if (!attribute || name === "" || name === attribute.name) return;
  store.updateTable(table.id, {
    logical: {
      ...table.logical,
      attributes: table.logical.attributes.map((a) =>
        a.id === attributeId ? { ...a, name } : a,
      ),
    },
  });
}

/** Changes the logical type family of a row (spec section 7.0). */
export function commitLogicalFamily(
  store: DiagramStore,
  table: Table,
  attributeId: string,
  family: string,
): void {
  const attribute = table.logical.attributes.find((a) => a.id === attributeId);
  if (!attribute) return;
  if ("family" in attribute.logicalType && attribute.logicalType.family === family) {
    return;
  }
  if (!BUILTIN_FAMILIES.some((item) => item.id === family)) return;
  store.updateTable(table.id, {
    logical: {
      ...table.logical,
      attributes: table.logical.attributes.map((a) =>
        a.id === attributeId ? { ...a, logicalType: { family } } : a,
      ),
    },
  });
}

/** Renames the physical column of a row. */
export function commitPhysicalName(
  store: DiagramStore,
  table: Table,
  fieldId: FieldId,
  value: string,
): void {
  const name = value.trim();
  const field = table.fields.find((f) => f.id === fieldId);
  if (!field || name === "" || name === field.name) return;
  store.updateField(table.id, fieldId, { name });
}

/**
 * Applies a physical type from the combobox (spec section 7.4): a user
 * choice always marks the pair explicit, so the lint layer stops
 * suggesting the mapped default for it.
 */
export function commitPhysicalType(
  store: DiagramStore,
  table: Table,
  fieldId: FieldId,
  fieldType: PhysicalSpec,
): void {
  const field = table.fields.find((f) => f.id === fieldId);
  if (!field || fieldType.type.trim() === "") return;
  store.updateField(table.id, fieldId, {
    fieldType,
    fieldTypeSource: "explicit",
  });
}

/** The relationship edits: the physical name plus the logical names and roles. */
export interface RelationshipPatch {
  physicalName?: string;
  logicalName?: string;
  parentRole?: string;
  childRole?: string;
}

export function commitRelationship(
  store: DiagramStore,
  relationship: Relationship,
  logical: LogicalRelationship | undefined,
  patch: RelationshipPatch,
): void {
  const physicalName = patch.physicalName?.trim();
  if (physicalName !== undefined && physicalName !== (relationship.name ?? "")) {
    store.updateRelationship(relationship.id, {
      name: physicalName === "" ? undefined : physicalName,
    });
  }
  const logicalUpdates: Partial<Omit<LogicalRelationship, "id">> = {};
  if (patch.logicalName !== undefined) {
    const value = patch.logicalName.trim();
    if (value !== (logical?.name ?? "")) {
      logicalUpdates.name = value === "" ? undefined : value;
    }
  }
  if (patch.parentRole !== undefined) {
    const value = patch.parentRole.trim();
    if (value !== (logical?.parentRole ?? "")) {
      logicalUpdates.parentRole = value === "" ? undefined : value;
    }
  }
  if (patch.childRole !== undefined) {
    const value = patch.childRole.trim();
    if (value !== (logical?.childRole ?? "")) {
      logicalUpdates.childRole = value === "" ? undefined : value;
    }
  }
  if (Object.keys(logicalUpdates).length > 0) {
    store.updateLogicalRelationship(relationship.id, logicalUpdates);
  }
}

/** Renames a subject area; an empty name does nothing. */
export function commitAreaName(
  store: DiagramStore,
  areaId: string,
  value: string,
): void {
  const name = value.trim();
  if (name === "") return;
  store.updateArea(areaId, { name });
}

/** The first unused physical name for a new pair: `field_1`, `field_2`, ... */
export function nextFieldName(table: Table): string {
  const taken = new Set(table.fields.map((field) => field.name));
  let index = table.fields.length + 1;
  while (taken.has(`field_${index}`)) index += 1;
  return `field_${index}`;
}

/**
 * Adds a field pair: the store command creates the physical field and the
 * paired logical attribute in one go (INV-4), and the field type starts
 * from the mapped suggestion of the default family, so the new row is
 * born consistent (spec section 7.0, fieldTypeSource "mapped").
 */
export function addFieldPair(store: DiagramStore, table: Table): void {
  const family = BUILTIN_FAMILIES.find((item) => item.id === "string");
  const suggestion = family
    ? suggestPhysicalSpec(
        { id: "", name: "", logicalType: { family: family.id } },
        store.diagram.database,
      )
    : undefined;
  const field: Field = {
    id: createId(),
    name: nextFieldName(table),
    fieldType: suggestion ?? { type: FALLBACK_TYPE },
    fieldTypeSource: "mapped",
  };
  store.addField(table.id, field);
}

/**
 * Removes a row across the layers. A paired or physical-only row goes
 * through the atomic removal of the store (the command removes the field,
 * the paired attribute and every index/constraint reference). A
 * logical-only attribute has no field to anchor the command, so it is
 * removed through the whole logical entity.
 */
export function removeFieldPair(
  store: DiagramStore,
  table: Table,
  row: FieldPairRow,
): void {
  if (row.field) {
    store.removeField(table.id, row.field.id);
    return;
  }
  if (row.attribute) {
    store.updateTable(table.id, {
      logical: {
        ...table.logical,
        attributes: table.logical.attributes.filter(
          (attribute) => attribute.id !== row.attribute?.id,
        ),
      },
    });
  }
}
