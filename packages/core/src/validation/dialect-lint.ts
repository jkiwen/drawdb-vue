import type { DatabaseType, Diagram } from "../models/diagram.ts";
import type { FieldId } from "../models/field.ts";
import { buildAttributeIndex } from "../models/invariants.ts";
import type { PhysicalSpec } from "../models/physical.ts";
import type { TableId } from "../models/table.ts";
import { BUILTIN_FAMILIES } from "../types/builtin-families.ts";
import {
  getTypeMetadata,
  isKnownTypeName,
} from "../types/registry.ts";
import {
  findDomainInScope,
  isKnownFamily,
  resolveType,
  type TypeScopeSnapshot,
} from "../types/resolve.ts";

/**
 * Dialect lint diagnostic model (spec section 6.2). This is a NEW channel,
 * separate from the DiagramIssue rules channel: all twelve codes are
 * type-system / dialect related. Index diagnostics stay on the
 * DiagramIssue channel (spec section 6.2 note).
 */
export type DialectSeverity = "error" | "warning" | "info";

export type DialectDiagnosticCode =
  /** The physical type name does not exist in the target dialect. */
  | "TYPE_NOT_IN_DIALECT"
  /** Same name, non-equivalent capabilities. */
  | "TYPE_CAPABILITY_MISMATCH"
  /** length/precision out of the dialect's allowed range. */
  | "PARAM_OUT_OF_RANGE"
  /** The logical type has no mapping in the target dialect. */
  | "MAPPING_MISSING"
  /** Fell back to the common family. */
  | "UNRESOLVED_TYPE"
  /** Exceeds the dialect's upper limit. */
  | "SIZE_EXCEEDS_MAX"
  /** The target dialect cannot materialize a custom type. */
  | "MATERIALIZATION_UNSUPPORTED"
  /** A logical attribute has no physical field (field level). */
  | "LOGICAL_ONLY"
  /** A physical field has no logical attribute (field level). */
  | "PHYSICAL_ONLY"
  /** Logical and physical types diverge semantically. */
  | "LOGICAL_PHYSICAL_DIVERGED"
  /** A logical relationship has no physical FK and is not physicalPending. */
  | "RELATIONSHIP_NOT_IMPLEMENTED"
  /** A domain/family name is already taken (Q1 global uniqueness). */
  | "NAME_CONFLICT";

export interface DialectDiagnostic {
  severity: DialectSeverity;
  code: DialectDiagnosticCode;
  scope: {
    tableId?: TableId;
    fieldId?: FieldId;
    domainId?: string;
    /** The logical relationship (spec section 3.7.4). */
    relationshipId?: string | number;
  };
  /** i18n key plus parameters. */
  message: string;
  /** A suggested replacement physical spec. */
  suggestion?: PhysicalSpec;
  /** Whether the suggestion can be applied with one click. */
  fixable: boolean;
}

/**
 * Dialects able to materialize a custom (logical-only) type definition
 * (spec section 6.2 MATERIALIZATION_UNSUPPORTED).
 */
const MATERIALIZING_DIALECTS: ReadonlySet<DatabaseType> = new Set([
  "postgres",
  "oraclesql",
]);

/**
 * Well-known per-dialect upper limits for sized types
 * (spec section 6.2 SIZE_EXCEEDS_MAX). Only the documented limits are
 * listed; unlisted types have no lint-imposed ceiling.
 */
const DIALECT_TYPE_LIMITS: Partial<
  Record<DatabaseType, Record<string, number>>
> = {
  mysql: { CHAR: 255, VARCHAR: 65535 },
  mariadb: { CHAR: 255, VARCHAR: 65535 },
  mssql: { CHAR: 8000, NCHAR: 4000, VARCHAR: 8000, NVARCHAR: 4000 },
  oraclesql: { CHAR: 2000, NCHAR: 1000, VARCHAR2: 4000, NVARCHAR2: 2000 },
};

function upper(value: string): string {
  return String(value ?? "").toUpperCase();
}

/**
 * Lint a diagram against its target dialect (spec section 6.1): a standing
 * legitimacy check that can run at any time, not a one-off event. Pure and
 * read-only — diagnostics are recomputed on every run and never stored
 * (spec section 6.5: only the user's *choices* are persisted).
 */
export function lintDialect(
  diagram: Diagram,
  scope: TypeScopeSnapshot,
): DialectDiagnostic[] {
  const database = diagram.database;
  const diagnostics: DialectDiagnostic[] = [];

  // NAME_CONFLICT: a loaded scope snapshot that bypassed registerDomain may
  // still collide with a builtin family (Q1 global uniqueness).
  const builtinNames = new Set(
    BUILTIN_FAMILIES.map((f) => f.id.toLowerCase()),
  );
  for (const level of ["diagram", "workspace", "application"] as const) {
    for (const domain of Object.values(scope[level].domains ?? {})) {
      if (builtinNames.has(domain.name.trim().toLowerCase())) {
        diagnostics.push({
          severity: "error",
          code: "NAME_CONFLICT",
          scope: { domainId: domain.id },
          message: `domain name "${domain.name}" collides with the builtin family "${domain.name.toLowerCase()}"`,
          fixable: false,
        });
      }
    }
  }

  for (const table of diagram.tables) {
    const attributeIndex = buildAttributeIndex(table);
    const coveredAttributeIds = new Set<string>();

    for (const field of table.fields) {
      const scopeRef = { tableId: table.id, fieldId: field.id };
      const typeName = upper(field.fieldType.type);
      const attribute = attributeIndex.get(field.id);

      if (!isKnownTypeName(database, typeName)) {
        // Hard conflict (spec section 6.4): the type does not exist in the
        // target dialect. Offer the mapping suggestion when one exists.
        const resolution = attribute
          ? resolveType(attribute, database, scope)
          : undefined;
        const suggestion =
          resolution && resolution.suggested && !resolution.unmapped
            ? resolution.suggested
            : undefined;
        diagnostics.push({
          severity: "error",
          code: "TYPE_NOT_IN_DIALECT",
          scope: scopeRef,
          message: `type ${typeName} does not exist in ${database}`,
          suggestion,
          fixable: suggestion !== undefined,
        });
      } else {
        const meta = getTypeMetadata(database, typeName);
        if (field.increment && meta && !meta.canIncrement) {
          diagnostics.push({
            severity: "warning",
            code: "TYPE_CAPABILITY_MISMATCH",
            scope: scopeRef,
            message: `${typeName} in ${database} cannot auto-increment`,
            fixable: false,
          });
        }
        if (field.unsigned && meta && meta.signed === false) {
          diagnostics.push({
            severity: "warning",
            code: "TYPE_CAPABILITY_MISMATCH",
            scope: scopeRef,
            message: `${typeName} in ${database} cannot be unsigned`,
            fixable: false,
          });
        }
        if (
          field.fieldType.length !== undefined &&
          meta &&
          !meta.isSized
        ) {
          diagnostics.push({
            severity: "warning",
            code: "PARAM_OUT_OF_RANGE",
            scope: scopeRef,
            message: `${typeName} in ${database} does not take a length`,
            fixable: false,
          });
        }
        if (
          (field.fieldType.precision !== undefined ||
            field.fieldType.scale !== undefined) &&
          meta &&
          !meta.hasPrecision
        ) {
          diagnostics.push({
            severity: "warning",
            code: "PARAM_OUT_OF_RANGE",
            scope: scopeRef,
            message: `${typeName} in ${database} does not take precision/scale`,
            fixable: false,
          });
        }
        const limit = DIALECT_TYPE_LIMITS[database]?.[typeName];
        if (
          limit !== undefined &&
          field.fieldType.length !== undefined &&
          field.fieldType.length > limit
        ) {
          diagnostics.push({
            severity: "warning",
            code: "SIZE_EXCEEDS_MAX",
            scope: scopeRef,
            message: `${typeName}(${field.fieldType.length}) exceeds the ${database} limit of ${limit}`,
            fixable: false,
          });
        }
      }

      if (
        field.fieldType.materialized &&
        !MATERIALIZING_DIALECTS.has(database)
      ) {
        diagnostics.push({
          severity: "warning",
          code: "MATERIALIZATION_UNSUPPORTED",
          scope: scopeRef,
          message: `${database} cannot materialize custom types`,
          fixable: false,
        });
      }

      if (!attribute) {
        diagnostics.push({
          severity: "info",
          code: "PHYSICAL_ONLY",
          scope: scopeRef,
          message: `field ${field.name} has no logical attribute`,
          fixable: false,
        });
        continue;
      }
      coveredAttributeIds.add(attribute.id);

      const resolution = resolveType(attribute, database, scope);
      if (resolution.unmapped) {
        const ref = attribute.logicalType;
        const isMappingMissing =
          ref.domainId !== undefined
            ? findDomainInScope(scope, ref.domainId) !== undefined
            : isKnownFamily(scope, ref.family);
        diagnostics.push({
          severity: "warning",
          code: isMappingMissing ? "MAPPING_MISSING" : "UNRESOLVED_TYPE",
          scope: scopeRef,
          message: isMappingMissing
            ? `logical type ${resolution.logicalName} has no mapping for ${database}`
            : `logical type ${resolution.logicalName} cannot be resolved`,
          fixable: false,
        });
      } else if (
        field.fieldTypeSource === "mapped" &&
        resolution.suggested &&
        (resolution.suggested.type !== field.fieldType.type ||
          resolution.suggested.length !== field.fieldType.length ||
          resolution.suggested.precision !== field.fieldType.precision ||
          resolution.suggested.scale !== field.fieldType.scale)
      ) {
        // Only "mapped" fields are expected to track the suggestion; for
        // explicit/imported fields the user's choice wins (spec section 4.2).
        diagnostics.push({
          severity: "info",
          code: "LOGICAL_PHYSICAL_DIVERGED",
          scope: scopeRef,
          message: `stored type ${field.fieldType.type} diverges from the mapping suggestion ${resolution.suggested.type}`,
          suggestion: resolution.suggested,
          fixable: true,
        });
      }
    }

    for (const attribute of table.logical.attributes) {
      if (!coveredAttributeIds.has(attribute.id)) {
        diagnostics.push({
          severity: "info",
          code: "LOGICAL_ONLY",
          scope: { tableId: table.id },
          message: `logical attribute ${attribute.name} has no physical field`,
          fixable: false,
        });
      }
    }
  }

  const physicalRelationshipIds = new Set(
    diagram.relationships.map((r) => r.id),
  );
  for (const logical of diagram.logicalRelationships ?? []) {
    if (logical.physicalPending || physicalRelationshipIds.has(logical.id)) {
      continue;
    }
    diagnostics.push({
      severity: "warning",
      code: "RELATIONSHIP_NOT_IMPLEMENTED",
      scope: { relationshipId: logical.id },
      message: `logical relationship ${logical.id} has no physical FK implementation`,
      fixable: false,
    });
  }

  return diagnostics;
}
