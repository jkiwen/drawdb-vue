export * from "./models/index.ts";
export * from "./commands/index.ts";
export * from "./export/index.ts";
export * from "./sql/import/index.ts";
export * from "./storage/index.ts";
export * from "./metadata/index.ts";
export * from "./plugins/index.ts";
export * from "./dbml/index.ts";
export * from "./validation/index.ts";
export * from "./layout/index.ts";
export * from "./serialize/index.ts";
export {
  DATABASE_TYPE_METADATA,
  DATABASE_TYPE_NAMES,
  FALLBACK_TYPE,
  TYPE_AFFINITY,
  TYPE_COLORS,
  canonicalTypeName,
  classifyDefaultKind,
  classifyTypeFamily,
  isKnownTypeName,
  typeColor,
  typeTakesSize,
} from "./types/registry.ts";
export type { TypeFamily } from "./types/registry.ts";
export * from "./types/family.ts";
export { BUILTIN_FAMILIES, BUILTIN_FAMILY_IDS } from "./types/builtin-families.ts";
export {
  emptyTypeScope,
  findDomainInScope,
  isKnownFamily,
  reconcilePhysicalTypes,
  registerDomain,
  resolveType,
  updateFamilyMapping,
  upsertScopeLayer,
  validatePhysicalType,
} from "./types/resolve.ts";
export type {
  FamilyOverride,
  ResolutionResult,
  TypeScopeLayer,
  TypeScopeLevel,
  TypeScopeSnapshot,
} from "./types/resolve.ts";
export * from "./utils/arrange-tables.ts";
export * from "./utils/clone.ts";
export * from "./utils/id.ts";

// The erwin compatibility layer (P7, spec section 16).
export type { InvalidMarker } from "./models/invalid-marker.ts";
export type { ErwinAttribute, ErwinDocument, ErwinDomain, ErwinEntity, ErwinField, ErwinRelationship, ErwinSkip, ErwinSkipReason, ErwinTypeRef } from "./erwin/erwin-model.ts";
export { readErwinDocument } from "./erwin/erwin-model.ts";
export type { ErwinImportOptions, ErwinImportReport, ErwinImportResult } from "./erwin/erwin-import.ts";
export { familyOfType, importErwinXml } from "./erwin/erwin-import.ts";
export type { XmlNode } from "./erwin/xml.ts";
export { parseXml } from "./erwin/xml.ts";
