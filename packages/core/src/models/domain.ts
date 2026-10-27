import type { DatabaseType } from "./diagram.ts";
import type { LogicalFamilyId, TypeParams } from "../types/family.ts";

/**
 * A logical domain (erwin: Domain, spec §3.3). A domain references its
 * family instead of copying the parameter spec, so parameter legality and
 * defaults have a single source of truth.
 */
export interface LogicalDomain {
  id: string;
  /** The domain name, e.g. "UnicodeString"; shown in the logical view. */
  name: string;
  /** The family the domain belongs to: parameter spec source + semantic tag. */
  family: LogicalFamilyId;
  /** Overrides of the family default parameters. */
  params?: TypeParams;
  /**
   * The physical shape per dialect; dialects not listed fall back to the
   * family mapping.
   */
  physical?: Partial<Record<DatabaseType, PhysicalDomainSpec>>;
  /**
   * Parent domain (erwin: Domain Parent). Reserved for DSL schema
   * redundancy and future compatibility; inheritance is NOT implemented in
   * this iteration (Q13) and resolvers must not follow the parent chain.
   */
  parentId?: string;
  /** The description of the domain. */
  comment?: string;
  builtin?: boolean;
}

export interface PhysicalDomainSpec {
  /** The physical type name, e.g. "NVARCHAR2". */
  type: string;
  /** Physical parameter overrides, e.g. { length: 100 }. */
  params?: TypeParams;
  /** The schema in this dialect (erwin physical domains support Schema). */
  schema?: string;
  /** Materialize into the target database as a native type. */
  materialized?: boolean;
}
