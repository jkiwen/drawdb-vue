/**
 * Cardinality of a relationship between two tables.
 */
export const Cardinality = {
  ONE_TO_ONE: "one_to_one",
  ONE_TO_MANY: "one_to_many",
  MANY_TO_ONE: "many_to_one",
} as const;

export type Cardinality = (typeof Cardinality)[keyof typeof Cardinality];

/**
 * Referential action applied on update / delete of a relationship.
 */
export const Constraint = {
  NONE: "No action",
  RESTRICT: "Restrict",
  CASCADE: "Cascade",
  SET_NULL: "Set null",
  SET_DEFAULT: "Set default",
} as const;

export type Constraint = (typeof Constraint)[keyof typeof Constraint];
