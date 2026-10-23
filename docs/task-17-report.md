# Task 17 — Build the Standalone Application

## Scope

The task builds the application that embeds the SDK:

- `packages/app/src/main.ts` — the entry of the application,
- `packages/app/src/App.vue` — the frame with the navigation,
- `packages/app/src/router/index.ts` — the routes,
- `packages/app/src/views/HomeView.vue` — the list of the diagrams,
- `packages/app/src/views/EditorView.vue` — the editor,
- `packages/app/src/views/TemplateView.vue` — the templates,
- `packages/app/src/services/storage.ts` — the persistence,
- `packages/app/src/services/templates.ts` — the starter diagrams,
- `packages/app/index.html`, `packages/app/vite.config.ts`,
  `packages/app/tsconfig.json` — the build,
- `packages/app/src/App.test.ts` — the specifications.

## The application

The application has three routes:

| Route | View |
| --- | --- |
| `/` | the list of the stored diagrams |
| `/editor`, `/editor/:id` | the editor |
| `/templates`, `/templates/:id` | the templates |

The editor is the `DrawDBEditor` of the SDK. It receives the diagram of the
route, the adapter of the persistence and the automatic saving.

The persistence is the `IndexedDBStorageAdapter` of the core. A browser
without IndexedDB (or a test) falls back to the memory adapter, so that the
application stays usable.

The templates are two starter diagrams (a blog and a store). A template
carries a diagram without an id: the application gives the diagram an id,
stores it and opens it in the editor.

## The build

`packages/app/vite.config.ts` maps `@drawdb/core` and `@drawdb/vue-sdk` onto
the source of the workspace, so that the application can be built without
building the packages first.

## Differences from the plan

- The plan mounts the application and looks for the stub of the router. The
  specification mounts the application with a router that keeps its history
  in memory and looks for the view of the route, because the stub of the
  router tells nothing about the application.
- The plan does not mention the services. The list of the diagrams and the
  templates need a place to read the persistence and the starter diagrams, so
  they live in `services/`.
- The application uses plain HTML and CSS instead of Naive UI. Naive UI is a
  dependency of the SDK and the editor uses it, but the three views of the
  application are simple enough for plain HTML.

## Environment work

**The linker of the workspace is now the hoisted one.** The isolated linker
creates symbolic links that Node cannot follow on this Windows host, so that
every package of the workspace received its own copy of Vue and of pinia. Two
copies of Vue mean two runtimes in one process: the components of the SDK
were rendered by a runtime that did not know the directives of the other one,
and the warning `injection "Symbol(pinia)" not found` appeared, because the
pinia of the application and the pinia of the SDK were two different
instances.

The setting lives in `pnpm-workspace.yaml` (`nodeLinker: hoisted`); pnpm 11
does not read the `.npmrc` of the workspace for it. With the hoisted linker
every package of the workspace resolves to the same copy of Vue, of pinia and
of Naive UI, and the warnings are gone.

**The type check of the application needs the declaration of the parser of
Oracle.** The sources of the core are part of the program of the application
(the path of `@drawdb/core` points at the source), so the application needs
the same path entry for `oracle-sql-parser` as the core and the SDK.

## Tests

`packages/app/src/App.test.ts` — 6 specifications:

- the application renders the view of the route,
- the stored diagrams are listed,
- a stored diagram can be deleted,
- the editor opens a diagram,
- the templates are listed,
- a template is copied into the persistence and opened in the editor.

The whole suite of the workspace passes (305 specifications) and the type
check of the three packages is clean.
