# Changelog

All notable changes of the drawDB Vue workspace are recorded in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
packages follow [semantic versioning](https://semver.org/).

> The packages are **not published to npm**. The version number marks the state
> of the development; the distribution is built and verified locally with
> `pnpm run pack:packages` (see the readme).

## Unreleased

The canvas of the SDK had no stylesheet at all: the class names of the tables,
of the fields and of the relationships existed in the templates only, so the
browser drew unstyled elements. The work below aligns the canvas with the
React application of drawDB.

The areas had the second half of the defect: they were drawn, and nothing else.
The pointer that landed on an area cleared the selection and panned the canvas,
so an area could not be selected; its corner had no handle; and a diagram that
kept its areas in `subjectAreas` hid them as soon as a new area was added.

### @drawdb/vue-sdk

- The first stylesheet of the SDK (`packages/sdk/src/components/Canvas/canvas.css`):
  the dotted background of the canvas, the table with its border, its shadow and
  its colour strip, the header, the rows of the fields, the grip, the handles,
  the relationship with its hover animation, the areas, the notes, the views,
  the minimap and the dark theme.
- The relationships no longer cross the tables: the control points of the curve
  follow the position of the two anchors and not the order of the relationship.
- The cardinality is drawn as a label (`1` or `n`), like the reference.
- The marks of the fields follow the reference: the primary key is a key icon,
  a field that accepts the null value shows a question mark, and the delete
  button appears only while the pointer is on the row.
- The height of the header of a table follows the height of its comment, so
  that the anchors of the relationships stay on the fields.
- The areas of the canvas are selected, resized and moved like the tables: a
  click selects one and outlines it in blue, the handle in its corner changes
  its size while the pointer moves (80×60 at the smallest), and the tables that
  sit inside an area follow it, in one change of the history.
- The writes of the areas (`addArea`, `updateArea`, `removeArea`,
  `previewAreaPositions`, `moveElements`) go through the element actions of the
  store and land in the collection the diagram reads (`areas` or
  `subjectAreas`), so an imported diagram keeps the areas of its file.

### @drawdb/core

- The classification of the types and their colours (`classifyTypeFamily`,
  `typeColor`, `TYPE_COLORS`), so that the canvas paints the type of a field
  with the colour of its family.
- `CompositeCommand` wraps the changes of one gesture, so that the drag of a
  group of elements — an area and the tables inside it — is one entry of the
  history and one undo puts them all back.

## 0.2.0

The second version closes the gap with the React application of drawDB. Every
capability of the phase 2 plan is in the SDK now, with the tests to hold it.

### @drawdb/core

- The quality validation of a diagram: `validateDiagram` reports structured
  issues with a code, a severity and the parameters of the message, for the
  tables, the fields, the indices, the constraints, the types, the enums, the
  views and the relationships.
- The automatic layout with dagre (`autoArrange`) and the inference of the
  relationships from the foreign keys (`inferRelationships`).
- The import and the export of a diagram as JSON (`exportDiagramJson`,
  `importDiagramJson`), including the legacy `.ddb` shape and the diagnostics
  of a rejected file.
- The missing commands: the batch of relationships, the automatic layout and
  the rest of the table, field and relationship operations.
- The type registry and the plugins gained the entries the editors needed.

### @drawdb/vue-sdk

- The canvas can be edited in place: the relationships are drawn between two
  handles, the fields are reordered by dragging, the tables are locked and the
  viewport is zoomed, with the minimap.
- The side panel carries every editor of the React application: the views, the
  types, the enums, the custom types, the SQL header and the issues panel.
- The dialogs: the SQL preview, the import (SQL, DBML and JSON), the image
  export and the automatic relationships.
- The fullscreen mode, the image export (`exportPng`) and the keyboard driven
  editing.
- The stores gained the actions of the phase 2 features and the selection was
  split into a store of its own.

### drawdb-vue-app

- The application imports and exports a diagram as JSON, arranges the tables
  and opens the issues of the diagram from its own toolbar.

### The workspace

- The workspace test runner runs every spec of every package in one process,
  with the Vue single file components compiled on the fly and the mocks of the
  UI library.

## 0.1.0

The first version of the Vue workspace. It publishes two packages and one
standalone application.

### @drawdb/core

- The data model of a diagram: tables, fields, relationships, notes, areas,
  enums, views and custom types.
- The export of SQL for seven dialects: MySQL, PostgreSQL, SQLite, MariaDB,
  MSSQL, Oracle SQL and a generic dialect.
- The import of SQL into a diagram, with the same seven dialects, including the
  inline primary keys, the composite foreign keys and the indices.
- The support of DBML: the parser, the exporter, the difference between two
  diagrams and the reconciliation of a parsed diagram with an existing one.
- The command pattern with an undo and a redo history (`CommandManager`).
- The storage adapters: an in-memory adapter and an IndexedDB adapter behind a
  common interface.
- The registry of the metadata schemas and the manager of the plugins with the
  extension points.
- The registry of the data types of the seven dialects, generated from the types
  of drawDB.

### @drawdb/vue-sdk

- The `DrawDBEditor` component with the controlled and the uncontrolled mode,
  the automatic saving, the loading of the plugins and the events.
- The canvas with the drag, the zoom, the selection and the virtualization of
  the elements, in the physical and in the logical view.
- The header, the side panel with the tables, the relationships, the notes, the
  areas, the enums, the views and the types.
- The five stores (diagram, interface, history, settings and saving) and the
  composables for the selection, the viewport, the drag, the keyboard
  shortcuts, the canvas events, the virtualization and the storage.
- The fifty-one locales of drawDB, migrated to Vue I18n, and the fallback to
  English for a missing translation.
- The type declarations of the whole public surface.

### drawdb-vue-app

- The standalone application with the list of the diagrams, the editor and the
  templates, and the persistence in the browser.

### The workspace

- The continuous integration (the type check, the build and the tests) and the
  release workflow that publishes the two packages.
- The end to end tests with Playwright and the integration tests of the
  application.
- The documentation: the readmes of the workspace and of the three packages, the
  design of the SDK and the plan of the implementation.
