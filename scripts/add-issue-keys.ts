/**
 * Adds the keys of an issue of the validator to the locales of the SDK.
 *
 * The keys of an issue are the ones the React application used, so that the
 * locales the migration wrote keep working. The keys are written by hand into
 * `scripts/i18n-issues.json` and merged into every locale; the locales that
 * were translated by the migration are left alone, the other ones take the
 * English message as their own.
 *
 * Usage: node --experimental-strip-types scripts/add-issue-keys.ts
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LOCALES = path.join(ROOT, "packages", "sdk", "src", "i18n", "locales");
const KEYS = path.join(HERE, "i18n-issues.json");

/**
 * The messages of the issues, in English.
 *
 * The placeholder names are the ones the rules of the validator put into the
 * `params` of the issue, so that a message reads the same in every language.
 */
const ENGLISH: Record<string, string> = {
  table_w_no_name: "The table has no name.",
  duplicate_table_by_name: "The name '{{table}}' is used by more than one table.",
  no_primary_key: "The table '{{table}}' has no primary key.",
  field_w_no_name: "The field of the table '{{table}}' has no name.",
  field_w_no_type: "The field '{{field}}' of the table '{{table}}' has no type.",
  field_w_no_values: "The enum field '{{field}}' of the table '{{table}}' has no values.",
  field_not_null_and_nullable:
    "The field '{{field}}' of the table '{{table}}' is marked as not null and as nullable.",
  duplicate_fields:
    "The name '{{field}}' is used by more than one field of the table '{{table}}'.",
  default_type_mismatch:
    "The default '{{default}}' is not valid for the type '{{type}}' of the field '{{field}}' of the table '{{table}}'.",
  inherited_duplicate_field:
    "The field '{{field}}' of the table '{{table}}' is already inherited.",
  index_w_no_name: "The index of the table '{{table}}' has no name.",
  index_w_no_fields: "The index '{{index}}' of the table '{{table}}' has no fields.",
  duplicate_index: "The name '{{index}}' is used by more than one index of the table '{{table}}'.",
  unique_constraint_w_no_fields:
    "The unique constraint '{{constraint}}' of the table '{{table}}' has no fields.",
  duplicate_unique_constraint:
    "The name '{{constraint}}' is used by more than one unique constraint of the table '{{table}}'.",
  type_with_no_name: "The custom type has no name.",
  duplicate_types: "The name '{{type}}' is used by more than one custom type.",
  type_w_no_fields: "The custom type '{{type}}' has no fields.",
  type_field_w_no_name: "The field of the custom type '{{type}}' has no name.",
  type_field_w_no_type: "The field '{{field}}' of the custom type '{{type}}' has no type.",
  type_field_w_no_values:
    "The enum field '{{field}}' of the custom type '{{type}}' has no values.",
  duplicate_type_fields:
    "The name '{{field}}' is used by more than one field of the custom type '{{type}}'.",
  enum_w_no_name: "The enum has no name.",
  duplicate_enums: "The name '{{enum}}' is used by more than one enum.",
  enum_w_no_values: "The enum '{{enum}}' has no values.",
  view_w_no_name: "The view has no name.",
  duplicate_views: "The name '{{view}}' is used by more than one view.",
  view_name_clashes_w_table: "The name '{{view}}' is also used by a table.",
  view_w_no_base_table: "The view '{{view}}' has no base table.",
  join_w_no_table: "The join of the view '{{view}}' has no table.",
  join_w_no_condition: "The join of the view '{{view}}' has no condition.",
  join_out_of_order:
    "The join of the view '{{view}}' does not follow the table of the previous join.",
  view_column_w_no_field: "The column of the view '{{view}}' has no field.",
  duplicate_view_columns:
    "The name '{{column}}' is used by more than one column of the view '{{view}}'.",
  relationship_references_missing_table:
    "The relationship '{{relationship}}' refers to a table that does not exist.",
  relationship_references_missing_field:
    "The relationship '{{relationship}}' refers to a field that does not exist.",
  duplicate_reference: "The name '{{relationship}}' is used by more than one relationship.",
  circular_dependency: "The relationship '{{relationship}}' takes part in a cycle of tables.",
  validation_internal_error: "The diagram could not be validated.",
};

async function main() {
  const english = await readFile(KEYS, "utf8").then(
    (text) => JSON.parse(text) as Record<string, string>,
    () => ENGLISH,
  );

  const files = (await readdir(LOCALES)).filter((file) => file.endsWith(".json"));
  let changed = 0;
  for (const file of files) {
    const full = path.join(LOCALES, file);
    const messages = JSON.parse(await readFile(full, "utf8")) as Record<string, string>;
    const before = JSON.stringify(messages);
    for (const [key, value] of Object.entries(english)) {
      if (!(key in messages)) {
        messages[key] = value;
      }
    }
    if (JSON.stringify(messages) === before) {
      continue;
    }
    const sorted: Record<string, string> = {};
    for (const key of Object.keys(messages).sort()) {
      sorted[key] = messages[key];
    }
    await writeFile(full, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
    changed += 1;
  }

  console.log(`added the keys of the issues to ${changed} locale(s)`);
}

await main();
