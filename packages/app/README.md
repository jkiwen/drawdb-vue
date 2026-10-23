# drawdb-vue-app

The standalone editor of drawDB. The application is a thin host around
`@drawdb/vue-sdk`: it shows the list of the diagrams, opens the editor and offers a
few templates to start with.

```bash
pnpm --filter drawdb-vue-app dev     # http://localhost:5173
pnpm --filter drawdb-vue-app build   # the production build in packages/app/dist
```

## The routes

| Route | View | Description |
| --- | --- | --- |
| `/` | `HomeView` | the list of the stored diagrams |
| `/editor` | `EditorView` | a new diagram |
| `/editor/:id` | `EditorView` | the diagram with the identifier |
| `/templates` | `TemplateView` | the list of the templates |
| `/templates/:id` | `TemplateView` | a template that is opened in a new diagram |

## The structure

```
packages/app
├── index.html                 the entry page
├── src
│   ├── main.ts                creates the application, the router and the pinia
│   ├── App.vue                the frame of the application
│   ├── router/index.ts        the routes
│   ├── views                  HomeView, EditorView and TemplateView
│   ├── services
│   │   ├── storage.ts         the IndexedDB adapter of the browser
│   │   ├── diagram-io.ts      the download and the reading of a diagram as JSON
│   │   └── templates.ts       the starter diagrams
│   └── styles.css             the styles of the application
└── vite.config.ts             the aliases to the sources of the packages
```

## Importing and exporting a diagram

The list of the diagrams downloads a diagram as a JSON file and imports one back
(`services/diagram-io.ts`):

| Button | Test id | What it does |
| --- | --- | --- |
| `Download` | `export-json` | downloads `<title>.json` with `exportDiagramJson` |
| `Import JSON` | `import-json` | opens the picker of a file, reads it with `importDiagramJson`, stores the diagram and opens it |

The editor view has a toolbar with the two remaining commands of the phase 2 features:

| Button | Test id | What it does |
| --- | --- | --- |
| `Auto layout` | `auto-layout` | calls `autoArrange()` on the editor, one undo step for the whole diagram |
| `Validate` | `validate-diagram` | calls `validate()` and opens the issues panel of the side panel |

The application imports the packages from their sources (the aliases of
`vite.config.ts`), so that a change in the SDK is visible without a build of the
packages. A production build compiles the application together with the packages.

## The storage

The diagrams are stored in the IndexedDB of the browser. If the browser does not offer
an IndexedDB (a private mode, a server side rendering), the application falls back to
an adapter that keeps the diagrams in the memory of the page.
