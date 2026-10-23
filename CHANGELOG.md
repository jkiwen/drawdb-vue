# Changelog

All notable changes of the drawDB Vue workspace are recorded in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
packages follow [semantic versioning](https://semver.org/).

## 1.0.0

The first release of the Vue workspace. It publishes two packages and one
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
