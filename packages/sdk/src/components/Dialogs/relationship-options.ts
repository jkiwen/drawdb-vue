import { Cardinality, Constraint } from "@drawdb/core";
import { t } from "../../i18n/index.ts";

/**
 * The options of the dialog that creates a relationship.
 *
 * They live in their own file, so that the dialog itself stays short.
 */

/** The cardinalities a relationship can have. */
export const cardinalityOptions = [
  { label: t("one_to_one"), value: Cardinality.ONE_TO_ONE },
  { label: t("one_to_many"), value: Cardinality.ONE_TO_MANY },
  { label: t("many_to_one"), value: Cardinality.MANY_TO_ONE },
];

/** The referential actions a relationship can have. */
export const constraintOptions = [
  { label: Constraint.NONE, value: Constraint.NONE },
  { label: Constraint.RESTRICT, value: Constraint.RESTRICT },
  { label: Constraint.CASCADE, value: Constraint.CASCADE },
  { label: Constraint.SET_NULL, value: Constraint.SET_NULL },
  { label: Constraint.SET_DEFAULT, value: Constraint.SET_DEFAULT },
];
