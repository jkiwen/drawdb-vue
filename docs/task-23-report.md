# Task 23 — core 图 JSON 导入导出（serialize）

**Plan:** `docs/superpowers/plans/2026-10-23-drawdb-vue-sdk-parity-plan.md` → Task 23
**Spec:** `docs/superpowers/specs/2026-10-23-drawdb-vue-sdk-parity-design.md` → §4.3

## Scope

The core package gained the reading and the writing of the json format of a
diagram — the format of the `.ddb` file of the React reference. The SDK uses
it for the import and the export of the dialog of Task 28.

| File | Content |
| --- | --- |
| `packages/core/src/serialize/types.ts` | `DiagramJson`, `ImportDiagnostic`, the class `ImportError` |
| `packages/core/src/serialize/export.ts` | `exportDiagramJson(diagram, options?)` |
| `packages/core/src/serialize/import.ts` | `importDiagramJson(source, options?)` |
| `packages/core/src/serialize/index.ts` | the barrel of the module |
| `packages/core/src/serialize/serialize.test.ts` | 15 specifications |
| `packages/core/src/index.ts` | exports the serialize module |

## The format

```json
{
  "id": "…", "title": "…", "database": "mysql", "sqlHeader": "…",
  "tables": [], "relationships": [], "notes": [],
  "subjectAreas": [], "types": [], "enums": [], "views": [],
  "metadata": {}
}
```

`exportDiagramJson(diagram, { pretty })` writes the json compact by default
and indented by two spaces on request. The areas of the diagram are written
in `subjectAreas`, from `diagram.areas ?? diagram.subjectAreas`.

`importDiagramJson(source, options)` reads the text of a json document, or an
object that has already been parsed. It never modifies its source.

## The errors

| Code | When |
| --- | --- |
| `json.parse_failed` | the text is not json (`diagnostics` carries the message of the parser) |
| `json.invalid_shape` | the source is not an object, the tables are missing, a collection is not a list, or the dialect is unknown |
| `relationship.missing_table` | a relationship points at a table that the diagram does not have |
| `relationship.missing_field` | a relationship points at a field that its table does not have |
| `database.mismatch` | the dialect of the file differs from the dialect of the host |

`ImportError` extends `Error` and carries the `code` and the `diagnostics`.

## The rules of the import

- The old field names of the React reference are accepted: `references`
  becomes `relationships` and `areas` becomes `subjectAreas`.
- A collection that the file does not have is an empty list.
- A file without a dialect is a `generic` diagram.
- **A dialect that the host does not expect is an error**, unless
  `options.allowDatabaseOverride` is `true`. The dialect of the result is
  then the dialect of the file.
- The ids of the tables and of the fields are compared as text, so a file
  that uses numbers and a file that uses strings work the same way.

## Differences from the plan

- **The shape of every collection is checked**, not only the shape of the
  tables. A file whose `notes` is a string is an error instead of a crash.
- **An unknown dialect is an error** (`json.invalid_shape`) instead of a
  silently wrong diagram.
- The plan describes `source` as `string | unknown`; the function accepts the
  two forms that the SDK needs — the text and the parsed object.

## Tests

- `node --experimental-strip-types scripts/run-tests.mjs serialize` → 15/15 pass.
- Full workspace suite → 410/410 pass (was 395 before the task).
- `pnpm run typecheck` → clean (core, sdk, app, example, e2e).
