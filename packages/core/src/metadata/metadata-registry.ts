import type { Metadata } from "../models/metadata.ts";
import type {
  MetadataSchema,
  MetadataTarget,
  MetadataValidationIssue,
} from "./metadata-schema.ts";
import { validateMetadataValues } from "./metadata-schema.ts";

/** Raised when a schema cannot be registered. */
export class MetadataSchemaRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataSchemaRegistryError";
  }
}

/**
 * Registry of metadata schemas.
 *
 * Plugins and host applications register schemas here; the SDK then validates
 * and normalises the custom data attached to diagram elements.
 */
export class MetadataRegistry {
  private readonly schemas = new Map<string, MetadataSchema>();

  /** Register a schema. Throws when the id is already taken. */
  register(schema: MetadataSchema): void {
    if (!schema?.id) {
      throw new MetadataSchemaRegistryError(
        "A metadata schema must have an id.",
      );
    }
    if (this.schemas.has(schema.id)) {
      throw new MetadataSchemaRegistryError(
        `A metadata schema with id "${schema.id}" is already registered.`,
      );
    }
    this.schemas.set(schema.id, schema);
  }

  /** Remove a schema. Returns false when the id was unknown. */
  unregister(id: string): boolean {
    return this.schemas.delete(id);
  }

  /** Look up a schema by id. */
  get(id: string): MetadataSchema | undefined {
    return this.schemas.get(id);
  }

  /** List every schema, optionally filtered by the element it applies to. */
  list(target?: MetadataTarget): MetadataSchema[] {
    const all = Array.from(this.schemas.values());
    return target ? all.filter((schema) => schema.target === target) : all;
  }

  /** True when a schema with the given id is registered. */
  has(id: string): boolean {
    return this.schemas.has(id);
  }

  /** Remove every registered schema. */
  clear(): void {
    this.schemas.clear();
  }

  /**
   * Validate a set of values against a registered schema.
   *
   * An unknown schema id produces a single issue rather than an exception, so
   * the UI can report it next to the other validation messages.
   */
  validate(schemaId: string, values: Metadata = {}): MetadataValidationIssue[] {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      return [
        {
          schemaId,
          key: "",
          message: `No metadata schema is registered for "${schemaId}".`,
        },
      ];
    }
    return validateMetadataValues(values, schema);
  }

  /**
   * Return the values with the schema defaults filled in.
   *
   * Values already present are never overwritten.
   */
  applyDefaults(schemaId: string, values: Metadata = {}): Metadata {
    const schema = this.schemas.get(schemaId);
    if (!schema) return { ...values };

    const result: Metadata = { ...values };
    for (const property of schema.properties) {
      if (result[property.key] === undefined && property.default !== undefined) {
        result[property.key] = property.default;
      }
    }
    return result;
  }
}
