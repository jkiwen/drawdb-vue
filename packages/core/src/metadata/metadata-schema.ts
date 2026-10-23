import type { Metadata, MetadataValue } from "../models/metadata.ts";

/** The kind of diagram element a metadata schema applies to. */
export type MetadataTarget =
  | "diagram"
  | "table"
  | "field"
  | "relationship"
  | "view"
  | "note"
  | "area";

/** The value types a metadata property can hold. */
export type MetadataPropertyType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "any";

/** A single piece of custom data attached to a diagram element. */
export interface MetadataProperty {
  /** Key the value is stored under. */
  key: string;
  /** Human readable label shown in the UI. */
  label?: string;
  /** Value type the property accepts. */
  type: MetadataPropertyType;
  /** Whether the property must be present. */
  required?: boolean;
  /** Value used when the property is missing. */
  default?: MetadataValue;
  /** Longer description shown in the UI. */
  description?: string;
  /** Restricts the value to a fixed set of options. */
  options?: string[];
}

/** A named group of metadata properties for one kind of diagram element. */
export interface MetadataSchema {
  /** Unique id of the schema, e.g. `table.owner`. */
  id: string;
  /** Human readable name. */
  name?: string;
  /** Longer description. */
  description?: string;
  /** The element the schema applies to. */
  target: MetadataTarget;
  /** The properties the schema defines. */
  properties: MetadataProperty[];
}

/** A single problem found while validating metadata values. */
export interface MetadataValidationIssue {
  /** Id of the schema the issue belongs to. */
  schemaId: string;
  /** Key of the offending property. */
  key: string;
  /** Human readable description of the problem. */
  message: string;
}

/** True when the value matches the declared property type. */
export function matchesPropertyType(
  value: MetadataValue,
  type: MetadataPropertyType,
): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    case "array":
      return Array.isArray(value);
    case "any":
      return true;
    default:
      return false;
  }
}

/**
 * Validate a set of metadata values against a schema.
 *
 * Unknown properties are reported as issues as well, so a schema always
 * describes the complete shape of its metadata bag.
 */
export function validateMetadataValues(
  values: Metadata,
  schema: MetadataSchema,
): MetadataValidationIssue[] {
  const issues: MetadataValidationIssue[] = [];
  const known = new Set(schema.properties.map((property) => property.key));

  for (const property of schema.properties) {
    const value = values[property.key];

    if (value === undefined || value === null) {
      if (property.required) {
        issues.push({
          schemaId: schema.id,
          key: property.key,
          message: `"${property.key}" is required.`,
        });
      }
      continue;
    }

    if (!matchesPropertyType(value, property.type)) {
      issues.push({
        schemaId: schema.id,
        key: property.key,
        message: `"${property.key}" must be of type ${property.type}.`,
      });
      continue;
    }

    if (
      property.options &&
      property.options.length > 0 &&
      !property.options.includes(String(value))
    ) {
      issues.push({
        schemaId: schema.id,
        key: property.key,
        message: `"${property.key}" must be one of: ${property.options.join(", ")}.`,
      });
    }
  }

  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      issues.push({
        schemaId: schema.id,
        key,
        message: `Unknown property "${key}".`,
      });
    }
  }

  return issues;
}
