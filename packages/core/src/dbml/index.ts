export {
  DBMLParseError,
  parseDBML,
  parseDBMLPartial,
  type ParsedDBML,
  type ParsedDBMLEnum,
  type ParsedDBMLField,
  type ParsedDBMLIndex,
  type ParsedDBMLRelationship,
  type ParsedDBMLTable,
  type ParseDBMLOptions,
} from "./parse.ts";

export { exportDBML } from "./export.ts";

export {
  diffDBML,
  type DBMLDiff,
  type DBMLDiffEnumUpdate,
  type DBMLDiffFieldUpdate,
  type DBMLDiffOperation,
  type DBMLDiffRelationshipCreate,
  type DBMLDiffRelationshipDelete,
  type DBMLDiffRelationshipUpdate,
  type DBMLDiffTableCreate,
  type DBMLDiffTableDelete,
  type DBMLDiffTableUpdate,
} from "./diff.ts";

export {
  DEFAULT_TABLE_COLOR,
  DEFAULT_TABLE_WIDTH,
  reconcileDBML,
  type ReconciledDBML,
} from "./reconcile.ts";

export {
  dbmlFieldSize,
  dbmlTypeName,
  inlineEnumTypeName,
  isInlineEnumType,
  quoteIdentifier,
} from "./types.ts";
