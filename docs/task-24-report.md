# Task 24 — core 命令补全（commands）

**Plan:** `docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md` → Task 24
**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md` → §4.4

## Scope

The commands of the core were reorganised. The ten files that held one
command each became five files that hold the commands of one family each, and
the families that the Phase 2 needs (the fields, the relationships, the flat
collections, the automatic layout) were added.

| File | Commands |
| --- | --- |
| `packages/core/src/commands/table-commands.ts` | `AddTableCommand`, `UpdateTableCommand`, `RemoveTableCommand`, `ResizeTableCommand`, `ToggleTableLockCommand` |
| `packages/core/src/commands/field-commands.ts` | `AddFieldCommand`, `UpdateFieldCommand`, `RemoveFieldCommand`, `MoveFieldCommand` |
| `packages/core/src/commands/relationship-commands.ts` | `AddRelationshipCommand`, `AddRelationshipsCommand`, `UpdateRelationshipCommand`, `RemoveRelationshipCommand` |
| `packages/core/src/commands/collection-commands.ts` | `AddEntityCommand`, `UpdateEntityCommand`, `RemoveEntityCommand` |
| `packages/core/src/commands/auto-arrange-command.ts` | `AutoArrangeCommand` |
| `packages/core/src/commands/commands.test.ts` | 18 specifications |
| `packages/core/src/commands/index.ts` | the barrel of the module |

The class names, the constructors and the behaviour did not change, so the
imports of the SDK (which only use the barrel) are untouched.

## The commands

- `AddTableCommand(diagram, table | { table, index })` — inserts the table at
  the given index, the undo removes it by its id.
- `UpdateTableCommand(diagram, tableId, updates)` — replaces the table and
  keeps a snapshot of the previous one for the undo. The snapshot is taken
  with `deepClone` (not with `structuredClone`, which cannot clone a Vue
  proxy).
- `RemoveTableCommand(diagram, tableId)` — also removes the relationships
  that point at the table and restores them on the undo.
- `ResizeTableCommand(diagram, tableId, width)` — the height of a table
  follows from its number of fields, so the command does not touch it.
- `ToggleTableLockCommand(diagram, tableId)` — a locked table is not moved by
  the automatic layout.
- `AddFieldCommand` / `UpdateFieldCommand` / `RemoveFieldCommand` — the
  fields of one table.
- `MoveFieldCommand(diagram, tableId, fromIndex, toIndex)` — moves a field
  and puts it back at `fromIndex` on the undo. It does nothing when the two
  indexes are equal.
- `AddRelationshipCommand` / `UpdateRelationshipCommand` /
  `RemoveRelationshipCommand` — one relationship at a time.
- `AddRelationshipsCommand(diagram, relationships)` — a batch, for the
  candidates of the automatic inference; the undo removes the batch by its
  ids.
- `AddEntityCommand` / `UpdateEntityCommand` / `RemoveEntityCommand` — the
  flat collections of a diagram: `notes`, `areas`, `subjectAreas`, `types`,
  `enums` and `views`. The entity is addressed by its id **or** by its name,
  because an enum has no id.
- `AutoArrangeCommand(diagram, positions, previous)` — writes the
  coordinates of a layout and restores the previous ones on the undo.

## The differences from the plan

- **Three more files were deleted than the plan lists.**
  `update-relationship.ts`, `remove-relationship.ts` and `add-entity.ts`
  were migrated into the new families as well, so that one family lives in
  one file.
- **The undo restores the exact previous state.** `ResizeTableCommand` and
  `ToggleTableLockCommand` delete the property again when it was absent
  before, so that the diagram is deeply equal to the snapshot of the test
  and not only equal in the values that it shows.
- **`SetDiagramCommand` was not added.** The properties of the diagram (the
  title, the dialect, the sql header) stay with the existing
  `UpdateDiagramCommand(diagram, updates)`, as the plan requires. The
  difference with the spec §4.4 is recorded here and repeated in the report
  of Task 32.

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs commands` → 24/24
  pass (18 new specifications and the 6 of the command manager).
- Full workspace suite → 428/428 pass (was 410 before the task).
- `pnpm run typecheck` → clean (core, sdk, app, example, e2e).
