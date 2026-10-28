import type { LogicalFamilyId, TypeParams } from "../types/family.ts";

/**
 * A logical type reference (spec §3.1): either a family or a logical domain.
 * The two shapes are mutually exclusive (enforced by the `never` markers);
 * a domain holds its own family reference, so resolution always reaches a
 * family.
 */
export type LogicalTypeRef =
  | { family: LogicalFamilyId; domainId?: never } // uses a family, e.g. "string"
  | { domainId: string; family?: never }; // uses a logical domain, e.g. "UnicodeString"

/**
 * A logical entity (the logical layer of a table, spec §3.0). Embedded in
 * `Table` one-to-one (§3.7.4, INV-7).
 */
export interface LogicalEntity {
  /** Stable id (erwin: EntryId). */
  id: string;
  /** Logical name (erwin: EntryName); shown in the logical view. */
  name: string;
  /** Logical description (erwin: EntryDesc). */
  description?: string;
  /**
   * Logical attributes; linked to physical fields by `attribute.fieldId`
   * (one-to-one, see spec §3.5).
   */
  attributes: LogicalAttribute[];
  /**
   * Exists only on the logical layer (erwin: Logical Only). With field-level
   * one-to-one enforced, the normal modelling path never produces this state
   * — it only marks asymmetries of erwin import source data (§3.5.1, §3.5.2).
   */
  logicalOnly?: boolean;
}

export interface LogicalAttribute {
  id: string;
  /** Logical name (erwin: attributeName); shown in the logical view. */
  name: string;
  /** Logical description (erwin: attributeDesc). */
  description?: string;
  /** The logical type: a family or a domain (spec §3.1). */
  logicalType: LogicalTypeRef;
  /** Field-level logical parameter overrides (e.g. length). */
  params?: TypeParams;
  /**
   * The linked physical field id. With field-level one-to-one enforced
   * (spec §3.5) it is required and must exist in normal data; asymmetric
   * import source data may leave it empty, in which case `logicalOnly` is
   * true.
   */
  fieldId?: string;
  /** Exists only on the logical layer (import asymmetry marker). */
  logicalOnly?: boolean;
  /**
   * Key semantics on the logical side (erwin: Key Group, spec §3.0): the
   * definition text lives on the physical index; the attribute only carries
   * the key role.
   */
  keyRole?: "primary" | "alternate" | "foreign";
  /** Whether the attribute is required (the only business constraint on the logical side, §3.7.4). */
  required?: boolean;
  /** The business value domain of an enum attribute (spec §3.3, D2). */
  values?: string[];
}
