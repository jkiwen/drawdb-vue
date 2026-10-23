import { computed } from "vue";
import { validateDiagram } from "@drawdb/core";
import type { DiagramIssue } from "@drawdb/core";
import { getLocale, localeMessages } from "../i18n/index.ts";
import { useDiagramStore } from "../stores/diagram.ts";

/**
 * The problems the editor found in the diagram.
 *
 * The list is derived from the diagram, so it changes with every edit. Each
 * issue carries the ids of the object it is about, which lets the panel
 * select the table or the field when the user clicks it. The label is read
 * from the messages of the locale of the SDK; the English fallback message of
 * the core is the last resort, so an unknown code still renders a readable
 * line.
 */
export interface LocalizedIssue extends DiagramIssue {
  label: string;
}

/**
 * The key of the message of an issue, and the names of the values it is
 * built from, per code of the core. The codes are stable; the keys are the
 * ones the SDK has carried since the React application.
 */
const KEYS: Record<string, [string, string[]]> = {
  "table.no_name": ["table_w_no_name", []],
  "table.duplicate_name": ["duplicate_table_by_name", ["table"]],
  "table.no_primary_key": ["no_primary_key", ["table"]],
  "field.no_name": ["field_w_no_name", ["table"]],
  "field.no_type": ["field_w_no_type", ["table"]],
  "field.no_values": ["field_w_no_values", ["table"]],
  "field.not_null_is_null": ["field_not_null_and_nullable", ["table", "field"]],
  "field.duplicate_name": ["duplicate_fields", ["table", "field"]],
  "field.default_mismatch": ["default_type_mismatch", ["table", "field", "type"]],
  "field.inherited_duplicate": ["inherited_duplicate_field", ["table", "field"]],
  "index.no_name": ["index_w_no_name", ["table"]],
  "index.no_fields": ["index_w_no_fields", ["table", "index"]],
  "index.duplicate_name": ["duplicate_index", ["table", "index"]],
  "unique_constraint.no_fields": ["unique_constraint_w_no_fields", ["table"]],
  "unique_constraint.duplicate_name": ["duplicate_unique_constraint", ["table", "constraint"]],
  "type.no_name": ["type_with_no_name", []],
  "type.duplicate_name": ["duplicate_types", ["type"]],
  "type.no_fields": ["type_w_no_fields", ["type"]],
  "type_field.no_name": ["type_field_w_no_name", ["type"]],
  "type_field.no_type": ["type_field_w_no_type", ["type"]],
  "type_field.no_values": ["type_field_w_no_values", ["type"]],
  "type_field.duplicate_name": ["duplicate_type_fields", ["type", "field"]],
  "enum.no_name": ["enum_w_no_name", []],
  "enum.duplicate_name": ["duplicate_enums", ["enum"]],
  "enum.no_values": ["enum_w_no_values", ["enum"]],
  "view.no_name": ["view_w_no_name", []],
  "view.duplicate_name": ["duplicate_views", ["view"]],
  "view.name_clashes_table": ["view_name_clashes_w_table", ["view"]],
  "view.no_base_table": ["view_w_no_base_table", ["view"]],
  "join.no_table": ["join_w_no_table", ["view"]],
  "join.no_condition": ["join_w_no_condition", ["view"]],
  "join.out_of_order": ["join_out_of_order", ["view"]],
  "view_column.no_field": ["view_column_w_no_field", ["view"]],
  "view_column.duplicate_name": ["duplicate_view_columns", ["view", "column"]],
  "relationship.missing_table": ["relationship_references_missing_table", ["relationship"]],
  "relationship.missing_field": ["relationship_references_missing_field", ["relationship"]],
  "relationship.duplicate_name": ["duplicate_reference", ["relationship"]],
  "relationship.circular": ["circular_dependency", ["relationship"]],
};

/** The messages of the locale of the sdk. */
function messages(): Record<string, string> {
  return localeMessages[getLocale()] ?? localeMessages.en ?? {};
}

/** Builds the label of an issue, from its message when the key is missing. */
export function localizeIssue(issue: DiagramIssue): LocalizedIssue {
  const entry = KEYS[issue.code];
  const template = entry ? messages()[entry[0]] : undefined;
  const label = template
    ? template.replace(
        /\{\{(\w+)\}\}/g,
        (_match, name: string) => issue.params?.[name] ?? "",
      )
    : issue.message;
  return { ...issue, label };
}

/**
 * The problems of the diagram of the editor, in the locale of the sdk.
 *
 * The list is derived from the diagram, so it changes with every edit.
 */
export function useIssues(): {
  issues: import("vue").ComputedRef<LocalizedIssue[]>;
  errors: import("vue").ComputedRef<LocalizedIssue[]>;
  warnings: import("vue").ComputedRef<LocalizedIssue[]>;
  refresh: () => void;
} {
  const diagram = useDiagramStore();

  const issues = computed<LocalizedIssue[]>(() => {
    void diagram.revision;
    return validateDiagram(diagram.diagram).map(localizeIssue);
  });

  const errors = computed(() =>
    issues.value.filter((issue) => issue.severity === "error"),
  );
  const warnings = computed(() =>
    issues.value.filter((issue) => issue.severity === "warning"),
  );

  /** Recomputes the list; the computed already follows the diagram. */
  function refresh(): void {
    void diagram.revision;
  }

  return { issues, errors, warnings, refresh };
}
