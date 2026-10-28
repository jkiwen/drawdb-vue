import type { DatabaseType } from "../models/diagram.ts";
import type { Field } from "../models/field.ts";
import { fieldSizeSuffix } from "../export/shared.ts";
import { typeTakesSize } from "../types/registry.ts";

const IDENT_SAFE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Quote a DBML identifier when it is not a plain identifier.
 *
 * DBML accepts bare identifiers, so safe names are emitted verbatim and
 * everything else is wrapped in double quotes with the quotes escaped.
 */
export function quoteIdentifier(name: string): string {
  const value = String(name ?? "");
  if (IDENT_SAFE_RE.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** True for the two inline enum types, `ENUM` and `SET`. */
export function isInlineEnumType(type: string): boolean {
  return type === "ENUM" || type === "SET";
}

/**
 * The synthetic enum name used for an inline enum field.
 *
 * DBML has no inline enum syntax, so an inline enum is exported as a
 * standalone `Enum` block whose name is derived from the field.
 */
export function inlineEnumTypeName(field: {
  name: string;
  values?: string[];
}): string {
  const values = Array.isArray(field.values) ? field.values : [];
  return `${field.name}_${values.join("_")}_t`;
}

/**
 * True when the dialect type carries a size or precision argument.
 */
export { typeTakesSize };

/**
 * Resolve the DBML type name of a field.
 *
 * Inline enums become their synthetic enum name, declared enums keep the
 * declared (original) casing, and everything else is lower-cased.
 */
export function dbmlTypeName(
  field: Field,
  enumNamesByUpperCase?: Map<string, string>,
): string {
  const type = String(field.fieldType?.type ?? "");
  if (isInlineEnumType(type)) return inlineEnumTypeName(field);

  const declared = enumNamesByUpperCase?.get(type.toUpperCase());
  if (declared) return declared;

  if (type.toUpperCase() === "TIMESTAMP WITH TIME ZONE") return "timestamptz";

  return type.toLowerCase();
}

/**
 * The DBML size suffix of a field, e.g. `(255)`.
 *
 * Empty when the dialect type takes no size or when the field has none.
 */
export function dbmlFieldSize(
  field: Field,
  database: DatabaseType,
): string {
  if (!typeTakesSize(field.fieldType.type, database)) return "";
  return fieldSizeSuffix(field.fieldType);
}
