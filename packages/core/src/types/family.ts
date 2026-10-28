import type { DatabaseType } from "../models/diagram.ts";
import type { PhysicalFlags } from "../models/physical.ts";

/**
 * The parameter keys a logical type may carry (spec §3.2).
 */
export type TypeParamKey = "length" | "precision" | "scale";

/**
 * The parameter values of a logical type reference, a domain or a family
 * default (spec §3.2–§3.4). Only the keys of `TypeParamKey` are meaningful.
 */
export type TypeParams = Partial<Record<TypeParamKey, number>>;

export interface ParamSpec {
  key: TypeParamKey;
  /** i18n key. */
  label: string;
  default?: number;
  min?: number;
  max?: number;
}

export interface TypeMapping {
  /** The physical type name of the target dialect, e.g. "VARCHAR2". */
  type: string;
  /** The parameters this mapping carries by default, e.g. { length: 50 }. */
  params?: Partial<TypeParams>;
  /** Additional physical semantics, e.g. unicode / unsigned. */
  flags?: PhysicalFlags;
}

/** The ids of the eleven builtin families (spec §3.2). */
export type BuiltinFamilyId =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "binary"
  | "enum"
  | "json"
  | "uuid";

/**
 * A logical family id. Builtin ids are the eleven literals above; custom
 * families may use any other string (spec §3.3.1: custom families must not
 * reuse a builtin id).
 */
export type LogicalFamilyId = BuiltinFamilyId | (string & {});

export interface LogicalTypeFamily {
  /** "string" | "decimal" | ... (spec §3.2) */
  id: LogicalFamilyId;
  /** i18n key. */
  label: string;
  /** The parameter spec this family accepts. */
  params: ParamSpec[];
  /** Family-level default parameters. */
  defaultParams?: TypeParams;
  /**
   * The default mapping per dialect. Builtin families must be exhaustive
   * (D1, spec §3.2); custom families may leave dialects out and fall back
   * to the common (undefined) family for those.
   */
  mappings: Record<DatabaseType, TypeMapping>;
  builtin: boolean;
}
