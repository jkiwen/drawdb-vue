import type { PhysicalField } from "./physical.ts";

export type FieldId = string | number;

/**
 * @deprecated The two-layer model (spec section 3) replaced the flat
 * `Field` with `PhysicalField`; this alias only eases the migration and
 * will be removed. New code must use `PhysicalField`.
 */
export type Field = PhysicalField;
