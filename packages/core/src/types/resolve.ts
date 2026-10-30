import type { DatabaseType } from "../models/diagram.ts";
import type { LogicalDomain } from "../models/domain.ts";
import { buildAttributeIndex } from "../models/invariants.ts";
import type { LogicalAttribute } from "../models/logical.ts";
import type { PhysicalField, PhysicalSpec } from "../models/physical.ts";
import type { Table } from "../models/table.ts";
import type { DialectDiagnostic } from "../validation/dialect-lint.ts";
import { BUILTIN_FAMILIES } from "./builtin-families.ts";
import type {
  LogicalFamilyId,
  TypeMapping,
  TypeParams,
} from "./family.ts";

/**
 * The type resolver (spec section 4.4, verbatim interface shape).
 *
 * The resolver is NOT the single source of truth: physical types are stored
 * on the field (`fieldType`). The resolver generates a *suggested* spec and
 * validates the stored one; whether a recompute is written back is decided
 * by `fieldTypeSource` (spec section 4.2).
 */

/** A per-family override at one scope layer (spec section 3.3.1). */
export interface FamilyOverride {
  defaultParams?: TypeParams;
  mappings?: Partial<Record<DatabaseType, TypeMapping>>;
}

export interface TypeScopeLayer {
  families?: Partial<Record<LogicalFamilyId, FamilyOverride>>;
  domains?: Record<string, LogicalDomain>;
}

export interface TypeScopeSnapshot {
  /** Application level (system defaults). */
  application: TypeScopeLayer;
  /** Workspace level (per-user overrides). */
  workspace: TypeScopeLayer;
  /** Diagram level (per-diagram overrides). */
  diagram: TypeScopeLayer;
}

export interface ResolutionResult {
  /** The suggested physical spec (generated from the mapping). */
  suggested?: PhysicalSpec;
  /** The physical spec actually stored on the field (may differ). */
  current?: PhysicalSpec;
  /** The display name for the logical view. */
  logicalName: string;
  family: LogicalFamilyId;
  /** True when resolution fell back to the common family. */
  unmapped: boolean;
  /** True when the field carries an explicit physical type. */
  isExplicit: boolean;
  diagnostics: DialectDiagnostic[];
}

export type TypeScopeLevel = "application" | "workspace" | "diagram";

/** Lookup order: diagram > workspace > application (spec section 5). */
const SCOPE_ORDER: TypeScopeLevel[] = ["diagram", "workspace", "application"];

export function emptyTypeScope(): TypeScopeSnapshot {
  return { application: {}, workspace: {}, diagram: {} };
}

type RegisterResult =
  | { ok: true; scope: TypeScopeSnapshot }
  | { ok: false; diagnostic: DialectDiagnostic };

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** All reserved type names across the three layers (Q1 global uniqueness). */
function reservedNames(scope: TypeScopeSnapshot): Set<string> {
  const names = new Set<string>();
  for (const family of BUILTIN_FAMILIES) {
    names.add(normalizeName(family.id));
  }
  for (const level of SCOPE_ORDER) {
    const layer = scope[level];
    for (const id of Object.keys(layer.families ?? {})) {
      names.add(normalizeName(id));
    }
    for (const domain of Object.values(layer.domains ?? {})) {
      names.add(normalizeName(domain.name));
    }
  }
  return names;
}

function nameConflict(name: string): RegisterResult {
  return {
    ok: false,
    diagnostic: {
      severity: "error",
      code: "NAME_CONFLICT",
      scope: {},
      message: `type name "${name}" is already taken`,
      fixable: false,
    },
  };
}

/**
 * Register a logical domain at one scope layer (pure; the caller stores the
 * returned snapshot). Names are globally unique across domains and families,
 * case-insensitive and whitespace-insensitive (Q1, spec section 3.3.1).
 */
export function registerDomain(
  scope: TypeScopeSnapshot,
  layer: TypeScopeLevel,
  domain: LogicalDomain,
): RegisterResult {
  if (reservedNames(scope).has(normalizeName(domain.name))) {
    return nameConflict(domain.name);
  }
  return {
    ok: true,
    scope: {
      ...scope,
      [layer]: {
        ...scope[layer],
        domains: { ...scope[layer].domains, [domain.name]: domain },
      },
    },
  };
}

/**
 * Override one mapping item of one family at one scope layer. Only that
 * family + dialect item is touched (spec section 3.3.1). A non-builtin
 * family id creates a custom family entry; its name must not collide with a
 * domain name (Q1).
 */
export function updateFamilyMapping(
  scope: TypeScopeSnapshot,
  layer: TypeScopeLevel,
  familyId: LogicalFamilyId,
  database: DatabaseType,
  mapping: TypeMapping,
): RegisterResult {
  const isBuiltin = BUILTIN_FAMILIES.some((f) => f.id === familyId);
  if (!isBuiltin) {
    const domains = new Set<string>();
    for (const level of SCOPE_ORDER) {
      for (const domain of Object.values(scope[level].domains ?? {})) {
        domains.add(normalizeName(domain.name));
      }
    }
    if (domains.has(normalizeName(familyId))) {
      return nameConflict(familyId);
    }
  }
  const existing = scope[layer].families?.[familyId];
  return {
    ok: true,
    scope: {
      ...scope,
      [layer]: {
        ...scope[layer],
        families: {
          ...scope[layer].families,
          [familyId]: {
            ...existing,
            mappings: { ...existing?.mappings, [database]: mapping },
          },
        },
      },
    },
  };
}

/** Merge a partial layer into one scope level (pure). */
export function upsertScopeLayer(
  scope: TypeScopeSnapshot,
  layer: TypeScopeLevel,
  data: TypeScopeLayer,
): TypeScopeSnapshot {
  return {
    ...scope,
    [layer]: {
      families: { ...scope[layer].families, ...data.families },
      domains: { ...scope[layer].domains, ...data.domains },
    },
  };
}

function findDomain(
  scope: TypeScopeSnapshot,
  name: string,
): LogicalDomain | undefined {
  for (const level of SCOPE_ORDER) {
    const layer = scope[level].domains;
    if (layer === undefined) {
      continue;
    }
    // A layer is keyed by the name of its domains (the registry is globally
    // unique by name); a diagram layer written by an import is keyed by the
    // id the attributes carry, so both keys are honoured.
    const domain = layer[name] ?? Object.values(layer).find((candidate) => candidate.id === name);
    if (domain) {
      return domain;
    }
  }
  return undefined;
}

/** Exported for the dialect linter: locate a domain down the scope chain. */
export function findDomainInScope(
  scope: TypeScopeSnapshot,
  name: string,
): LogicalDomain | undefined {
  return findDomain(scope, name);
}

/**
 * Exported for the dialect linter: true when the family is builtin or has at
 * least one scope-layer entry (i.e. the family itself is known, and an
 * unmapped resolution means MAPPING_MISSING rather than UNRESOLVED_TYPE).
 */
export function isKnownFamily(
  scope: TypeScopeSnapshot,
  familyId: LogicalFamilyId,
): boolean {
  if (builtinFamily(familyId)) {
    return true;
  }
  return SCOPE_ORDER.some((level) => scope[level].families?.[familyId]);
}

function builtinFamily(id: LogicalFamilyId) {
  return BUILTIN_FAMILIES.find((f) => f.id === id);
}

/** First mapping for family+dialect down the scope chain, then builtin. */
function findFamilyMapping(
  scope: TypeScopeSnapshot,
  familyId: LogicalFamilyId,
  database: DatabaseType,
): TypeMapping | undefined {
  for (const level of SCOPE_ORDER) {
    const mapping = scope[level].families?.[familyId]?.mappings?.[database];
    if (mapping) {
      return mapping;
    }
  }
  return builtinFamily(familyId)?.mappings[database];
}

/** First defaultParams down the scope chain, then builtin. */
function findFamilyDefaultParams(
  scope: TypeScopeSnapshot,
  familyId: LogicalFamilyId,
): TypeParams | undefined {
  for (const level of SCOPE_ORDER) {
    const params = scope[level].families?.[familyId]?.defaultParams;
    if (params) {
      return params;
    }
  }
  return builtinFamily(familyId)?.defaultParams;
}

function mergeParams(
  ...layers: Array<TypeParams | undefined>
): TypeParams {
  const merged: TypeParams = {};
  for (const layer of layers) {
    Object.assign(merged, layer);
  }
  return merged;
}

function toPhysicalSpec(
  type: string,
  params: TypeParams,
  flags?: TypeMapping["flags"],
  materialized?: boolean,
): PhysicalSpec {
  return {
    type,
    ...(params.length !== undefined ? { length: params.length } : {}),
    ...(params.precision !== undefined ? { precision: params.precision } : {}),
    ...(params.scale !== undefined ? { scale: params.scale } : {}),
    ...(flags ? { flags } : {}),
    ...(materialized ? { materialized } : {}),
  };
}

/**
 * Resolve a logical attribute to a suggested physical spec for the target
 * dialect (spec section 4.1). Parameter priority, high to low: attribute >
 * domain > family default > mapping-carried. The physical shape is
 * `domain.physical[D] ?? family.mappings[D]`, each looked up down the
 * diagram > workspace > application chain, first hit wins (spec section 5).
 */
export function resolveType(
  attribute: LogicalAttribute,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): ResolutionResult {
  const diagnostics: DialectDiagnostic[] = [];
  const ref = attribute.logicalType;

  const domain =
    ref.domainId !== undefined ? findDomain(scope, ref.domainId) : undefined;
  const familyId: LogicalFamilyId = domain
    ? domain.family
    : ref.domainId !== undefined
      ? "__unknown__"
      : ref.family;
  const logicalName = domain ? domain.name : (ref.family ?? String(ref.domainId));

  if (ref.domainId !== undefined && !domain) {
    diagnostics.push({
      severity: "warning",
      code: "UNRESOLVED_TYPE",
      scope: {},
      message: `logical domain "${ref.domainId}" is not defined`,
      fixable: false,
    });
    return {
      logicalName: String(ref.domainId),
      family: familyId,
      unmapped: true,
      isExplicit: false,
      diagnostics,
    };
  }

  const familyDefaults = findFamilyDefaultParams(scope, familyId);

  // Physical shape: domain override for the dialect, else the family mapping.
  const domainPhysical = domain?.physical?.[database];
  const familyMapping = findFamilyMapping(scope, familyId, database);

  if (domainPhysical) {
    const params = mergeParams(
      domainPhysical.params,
      familyDefaults,
      domain?.params,
      attribute.params,
    );
    return {
      suggested: toPhysicalSpec(
        domainPhysical.type,
        params,
        undefined,
        domainPhysical.materialized,
      ),
      logicalName,
      family: familyId,
      unmapped: false,
      isExplicit: false,
      diagnostics,
    };
  }

  if (familyMapping) {
    const params = mergeParams(
      familyMapping.params,
      familyDefaults,
      domain?.params,
      attribute.params,
    );
    return {
      suggested: toPhysicalSpec(
        familyMapping.type,
        params,
        familyMapping.flags,
      ),
      logicalName,
      family: familyId,
      unmapped: false,
      isExplicit: false,
      diagnostics,
    };
  }

  // Common fallback: the family has no mapping for this dialect (spec 4.3).
  diagnostics.push({
    severity: "warning",
    code: "UNRESOLVED_TYPE",
    scope: {},
    message: `logical family "${String(familyId)}" has no mapping for ${database}; fell back to common`,
    fixable: false,
  });
  return {
    suggested: { type: String(familyId).toUpperCase() },
    logicalName,
    family: familyId,
    unmapped: true,
    isExplicit: false,
    diagnostics,
  };
}

function specEquals(a: PhysicalSpec, b: PhysicalSpec): boolean {
  return (
    a.type === b.type &&
    a.length === b.length &&
    a.precision === b.precision &&
    a.scale === b.scale
  );
}

/**
 * Compare the stored physical spec against the mapping suggestion; never
 * writes back (spec section 4.2).
 */
export function validatePhysicalType(
  attribute: LogicalAttribute,
  field: PhysicalField,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): DialectDiagnostic[] {
  const result = resolveType(attribute, database, scope);
  const diagnostics = result.diagnostics.map((d) => ({
    ...d,
    scope: { ...d.scope, fieldId: field.id },
  }));
  if (
    result.suggested &&
    !result.unmapped &&
    !specEquals(result.suggested, field.fieldType)
  ) {
    diagnostics.push({
      severity: "info",
      code: "LOGICAL_PHYSICAL_DIVERGED",
      scope: { fieldId: field.id },
      message: `stored physical type ${field.fieldType.type} diverges from the mapping suggestion ${result.suggested.type}`,
      suggestion: result.suggested,
      fixable: true,
    });
  }
  return diagnostics;
}

/**
 * Recompute physical types for `fieldTypeSource === "mapped"` fields and
 * write them back; `explicit` and `imported` fields are never touched
 * (spec section 4.2). The input table is not mutated.
 */
export function reconcilePhysicalTypes(
  table: Table,
  database: DatabaseType,
  scope: TypeScopeSnapshot,
): Table {
  const attributeIndex = buildAttributeIndex(table);
  const fields = table.fields.map((field) => {
    if (field.fieldTypeSource !== "mapped") {
      return field;
    }
    const attribute = attributeIndex.get(field.id);
    if (!attribute) {
      return field;
    }
    const result = resolveType(attribute, database, scope);
    if (!result.suggested || result.unmapped) {
      return field;
    }
    if (specEquals(result.suggested, field.fieldType)) {
      return field;
    }
    return { ...field, fieldType: result.suggested };
  });
  return { ...table, fields };
}
