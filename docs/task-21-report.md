# Task 21 — core 图质量校验（validation）

**Plan:** `docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md` → Task 21
**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md` → §4.1

## Scope

The core package gained a framework-free validator that reports the quality
problems of a diagram as **structured issues** instead of translated strings.
The SDK localizes them later (Task 30).

| File | Content |
| --- | --- |
| `packages/core/src/validation/types.ts` | `IssueSeverity`, `DefaultKind` (re-exported from the type registry), `DiagramIssue`, `ValidationOptions` |
| `packages/core/src/validation/rules.ts` | one exported function per rule + `resolveDefaultKind` / `isDefaultValid` |
| `packages/core/src/validation/validate.ts` | the aggregator `validateDiagram` |
| `packages/core/src/validation/index.ts` | the barrel of the module |
| `packages/core/src/validation/validate.test.ts` | 46 specifications |
| `packages/core/src/types/registry.ts` | regenerated with `defaultKind` per type |
| `scripts/generate-type-registry.mjs` | emits `defaultKind` and `classifyDefaultKind` |
| `packages/core/src/index.ts` | exports the validation module |
| `scripts/plan-status.mjs` | accepts `--plan <path>` (the Phase 2 plan) |
| `scripts/verify-plan.test.ts` | covers the alternative plan path |

## The rules

| Code | Severity | Rule |
| --- | --- | --- |
| `table.no_name` | error | a table without a name |
| `table.duplicate_name` | error | two tables with the same name (case-insensitive) |
| `table.no_primary_key` | warning | a table with fields but no primary key |
| `field.no_name` | error | a field without a name |
| `field.no_type` | error | a field without a type |
| `field.no_values` | error | an `ENUM`/`SET` field without values |
| `field.duplicate_name` | error | two fields of one table with the same name |
| `field.default_mismatch` | error | a default that the type does not accept |
| `field.not_null_is_null` | warning | a field that is not null **and** nullable |
| `field.inherited_duplicate` | warning | a field that an inherited table already has |
| `relationship.missing_table` | error | a relationship whose table is gone |
| `relationship.missing_field` | error | a relationship whose field is gone |
| `relationship.duplicate_name` | error | two relationships with the same name |
| `relationship.circular` | warning | a relationship that closes a cycle of tables (once per cycle) |
| `view.no_name` / `view.duplicate_name` | error | the name of a view |
| `view.no_base_table` | error | a view without a base table |
| `view.name_clashes_table` | warning | a view that has the name of a table |
| `join.no_table` / `join.no_condition` | error | a join without a table or without a condition |
| `join.out_of_order` | warning | a join that does not follow the table of the previous join |
| `view_column.no_field` | error | a column whose field is gone |
| `view_column.duplicate_name` | error | two columns of a view with the same alias |
| `index.no_name` / `index.no_fields` / `index.duplicate_name` | error | the indices of a table |
| `unique_constraint.no_fields` / `unique_constraint.duplicate_name` | error | the unique constraints of a table |
| `type.no_name` / `type.duplicate_name` / `type.no_fields` | error | the custom types |
| `type_field.no_name` / `type_field.no_type` / `type_field.duplicate_name` | error | the fields of a custom type |
| `enum.no_name` / `enum.duplicate_name` / `enum.no_values` | error | the enums |
| `validation.internal_error` | error | the diagram is malformed and cannot be validated |

## The default kinds

`DefaultKind` is `numeric | boolean | date | text | none`. The generator
derives it from the name of the type; a type whose dialect metadata carries
`noDefault` is `none`. `isDefaultValid` always accepts an empty value, a
function call (`now()`) and a keyword (`CURRENT_TIMESTAMP`).

## Differences from the plan

- **The rules take the diagram, not the database.** The plan describes the
  signature `(diagram, database) => DiagramIssue[]`. Only
  `checkDefaultValues` needs the dialect, so it takes it as a second
  argument and `validateDiagram` passes `options.database ?? diagram.database`.
  Every other rule takes the diagram alone.
- **`field.inherited_duplicate` is an extra rule.** `Table.inherits` is a list
  of table ids, so the rule looks the parents up by id **and** by name.
- **The messages are English fallbacks** with the parameters for the
  localization of the SDK in `issue.params`.

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs validation` → 46/46 pass.
- Full workspace suite → 381/381 pass (was 334 before the task).
- `pnpm run typecheck` → clean (core, sdk, app, example, e2e).
