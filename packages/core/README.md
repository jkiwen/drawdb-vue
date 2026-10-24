# @drawdb/core

The framework independent core of the drawDB Vue SDK. It contains the data model of a
diagram, the commands that change it, the SQL and DBML readers and writers, the storage
adapters, the metadata registry and the plugin system.

The package has **no runtime dependency on Vue** and can be used on its own in a Node
process (a server side diagram service, a script, a test).

```bash
npm install @drawdb/core
```

## The data model

A diagram is a plain object, every entity owns an `id` that is unique inside the
diagram.

```ts
import { createEmptyDiagram, type Diagram } from "@drawdb/core";

const diagram: Diagram = createEmptyDiagram({ id: "shop", database: "postgres" });
```

```ts
interface Diagram {
  id: string;
  name: string;
  database: DatabaseType;
  title: string;
  tables: Table[];
  relationships: Relationship[];
  notes: Note[];
  areas: Area[];
  enums: Enum[];
  views: View[];
  types: CustomType[];
  sqlHeader?: string;
}
```

`DatabaseType` is one of `mysql`, `postgres`, `sqlite`, `mssql`, `mariadb`,
`oraclesql` and `generic`.

## SQL

Seven dialects can be written and read.

```ts
import { exportSQL, importSQL } from "@drawdb/core";

const sql = exportSQL(diagram); // CREATE TABLE ... for the database of the diagram

const restored = importSQL(sql, "postgres"); // { tables, relationships, ... }
```

The reader of a dialect is tolerant: it accepts the dialect of another database as a
fallback (`generic` uses the MySQL reader) and reports the position of a syntax error:

```
Failed to parse SQL for database "mysql" at line 4, column 12: Unexpected token
```

## DBML

```ts
import { exportDBML, parseDBML, diffDBML, reconcileDBML } from "@drawdb/core";

const dbml = exportDBML(diagram);
const parsed = parseDBML(dbml, { database: "postgres" }); // a diagram
const changes = diffDBML(parsed, otherDiagram); // the operations between two diagrams
```

`parseDBML` returns a diagram with the tables, the relationships and the enums of the
document, `diffDBML` compares two diagrams and returns the operations that turn the
first one into the second one, `reconcileDBML` merges a parsed document into an existing
diagram and keeps the positions and the identifiers of the entities that already
existed.

## Commands and the history

Every change of a diagram is a command. The commands are the single source of truth for
the undo and the redo.

```ts
import { CommandManager, AddTableCommand, UpdateTableCommand } from "@drawdb/core";

const history = new CommandManager();
history.execute(new AddTableCommand(diagram, table));
history.execute(new UpdateTableCommand(diagram, table.id, { name: "customers" }));

history.canUndo; // true
history.undo(); // the table is called "customers" again
history.redo();
```

| Command | Changes |
| --- | --- |
| `AddTableCommand` | adds a table |
| `UpdateTableCommand` | changes the properties of a table |
| `RemoveTableCommand` | removes a table and its relationships |
| `AddRelationshipCommand` | adds a relationship |
| `AddRelationshipsCommand` | adds a batch of relationships (one undo step) |
| `AutoArrangeCommand` | writes the positions the layout computed |
| `AddEntityCommand` | adds a note, an area, an enum, a view or a type |
| `UpdateFieldCommand` | changes a field of a table |

## The validation of a diagram

```ts
import { validateDiagram } from "@drawdb/core";

const issues = validateDiagram(diagram, { database: "postgres", severity: "warning" });

issues[0];
// {
//   code: "field.no_type",
//   severity: "error",
//   message: "The field has no type.",
//   params: { table: "users", field: "email" },
//   tableId: "t1",
//   fieldId: "f2",
// }
```

`validateDiagram` never throws: an internal failure is reported as an issue with the
code `validation.internal_error`. The severity of an issue is `error` or `warning`, and
a database restricts the rules to what that dialect allows.

## The layout and the inference

```ts
import { autoArrange, inferRelationships } from "@drawdb/core";

const positions = autoArrange(diagram.tables, diagram.relationships); // [{ x, y }]
const candidates = inferRelationships(diagram.tables, diagram.relationships);
```

`autoArrange` returns the new origin of every table, in the order of the tables, and
leaves a locked table where it is. `inferRelationships` proposes the relationships that
are missing between a foreign key and a primary key of another table; a candidate that
carries the id `infer_<table>_<field>_<parent>` is a new one, and the candidates that
are already known are skipped.

## The diagram as JSON

```ts
import { exportDiagramJson, importDiagramJson, ImportError } from "@drawdb/core";

const json = exportDiagramJson(diagram, { pretty: true }); // the diagram as a string

try {
  const restored = importDiagramJson(json); // a diagram
} catch (error) {
  if (error instanceof ImportError) {
    error.code; // json.parse_failed, json.invalid_shape, relationship.missing_table, ...
    error.diagnostics; // [{ message, line?, column? }]
  }
}
```

The reader accepts the file of the React application as well: the old field names
`references` and `areas` are read as `relationships` and `subjectAreas`, and a diagram
without a `database` is read as `generic`.

## Storage

```ts
import { MemoryStorageAdapter, IndexedDBStorageAdapter } from "@drawdb/core";

const memory = new MemoryStorageAdapter();
const browser = new IndexedDBStorageAdapter(); // the diagrams of the local browser
await browser.save(diagram);
const restored = await browser.load("shop");
```

Both adapters implement the same interface:

```ts
interface StorageAdapter {
  load(id: string): Promise<Diagram | null>;
  save(diagram: Diagram): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Diagram[]>;
  listIds(): Promise<string[]>;
  clear(): Promise<void>;
}
```

## Metadata and plugins

The metadata registry validates the custom properties of the entities of a diagram.

```ts
import { MetadataRegistry } from "@drawdb/core";

const registry = new MetadataRegistry();
registry.register({
  id: "cost-center",
  name: "Cost centre",
  target: "table",
  properties: [{ key: "costCentre", label: "Cost centre", type: "string" }],
});
registry.validate("cost-centre", { costCentre: 42 });
// [{ schemaId: "cost-centre", key: "costCentre", message: '"costCentre" must be of type string.' }]
```

The plugin manager activates the plugins and collects the extensions they register at
the known extension points (`toolbar`, `context-menu`, `panel`, `dialog`, `command`,
`field-type` and `export-format`).

```ts
import { PluginManager } from "@drawdb/core";

const plugins = new PluginManager();
plugins.register({
  id: "my-plugin",
  name: "My plugin",
  version: "1.0.0",
  activate(context) {
    context.registerExtension({
      id: "my-plugin:toolbar",
      point: "toolbar",
      handler: () => console.log("clicked"),
    });
  },
});
await plugins.activateAll(context);
```

## The colours of the types

The registry of the types knows the family of a type, and the family has a
colour. The canvas paints the type of a field with it.

```ts
import { classifyTypeFamily, typeColor } from "@drawdb/core";

classifyTypeFamily("INTEGER"); // "integer"
classifyTypeFamily("VARCHAR"); // "string"
typeColor("INTEGER"); // "#eab308"
typeColor("VARCHAR"); // "#f97316"
```

A type that the registry knows is classified with its own metadata: a type with
quotes is a string, a type that can be incremented is an integer, and a type
with a precision is a decimal.

## Building

```bash
pnpm --filter @drawdb/core build   # the distribution in packages/core/dist
```

The package is published as ESM with the type declarations next to the sources.
