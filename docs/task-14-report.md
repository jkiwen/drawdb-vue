# Task 14 Report: Implement DrawDBEditor Main Component

## Scope

Creates the editor component of the SDK and the public entry point of the package:

| File | Responsibility |
| --- | --- |
| `packages/sdk/src/components/DrawDBEditor.vue` | Composes the header, the canvas and the side panel. Owns the controlled and the uncontrolled mode, the automatic saving, the plugin life cycle and the events of the editor. |
| `packages/sdk/src/components/index.ts` | Barrel of the editor and of the component folders. |
| `packages/sdk/src/types/sdk-options.ts` | The public types of the SDK: `ViewMode`, `EditorTheme`, `ChangeInfo`, `EditorSelection`, `SDKPluginContext`, `SDKPlugin`, `DrawDBEditorOptions`. |
| `packages/sdk/src/index.ts` | The entry point of the package. Exports the components, the stores, the composables and the types, and offers `DrawDBVueSdk` as a Vue plugin. |
| `packages/sdk/src/components/DrawDBEditor.test.ts` | The spec of the editor. |

The component offers the props of the specification: `modelValue`, `initialValue`,
`database`, `viewMode`, `readonly`, `locale`, `theme`, `plugins`, `metadataSchema`,
`customTypes`, `storage`, `autoSave` and `autoSaveInterval`. It emits
`update:modelValue`, `change`, `save`, `export-sql`, `export-dbml`, `import-sql`,
`error` and `select`.

## Dependencies

- The stores of Task 9 (`useDiagramStore`, `useUIStore`, `useHistoryStore`, `useSaveStore`).
- The components of Task 11 (canvas), Task 12 (header) and Task 13 (side panel).
- `PluginManager` and `MetadataRegistry` of `@drawdb/core` for the plugins.
- `exportSQL`, `importSQL` and `exportDBML` of `@drawdb/core` for the imports and the exports.
- `deepClone` of `@drawdb/core` for the snapshots the editor emits, because
  `structuredClone` refuses to clone the reactive proxies of Vue.

## The modes of the editor

- **Uncontrolled**: `initialValue` is read once, the editor owns the diagram.
- **Controlled**: while `modelValue` is set, every change is emitted as
  `update:modelValue` together with a `change` event. The diagram the host
  application sends back is compared with the current one, so the echo of the
  editor is ignored and the undo history survives the round trip.
- The `database` prop follows the diagram, the `customTypes` prop adds the types it
  does not know yet, and the `storage` prop is handed to the save store.

## The plugin life cycle

The editor registers the plugins of the `plugins` prop in the core `PluginManager` and
activates them with a context that extends the core context with the stores of the
SDK, a slot registry, a command registry and a metadata registry. A plugin therefore
can:

- read and change the diagram through `context.diagramStore`,
- contribute a component with `context.registerSlot("name", Component)`,
- contribute a command with `context.registerCommand("key", handler)`, which the host
  application triggers with the exposed `runCommand` method,
- contribute a metadata schema with `context.registerMetadata(schema)`.

## Differences from the plan

- The plan does not name the events of the editor. The implementation emits the events
  of the specification and adds `export-dbml`, because the menu of the header offers
  the DBML export.
- The plan does not say how the controlled mode avoids a loop. The editor remembers the
  diagram it emitted last and compares the incoming diagram with the current one, so
  the echo of the editor never replaces the diagram and never clears the history.
- The plan does not describe the menu of the header. The editor handles the entries of
  the menu (`file:save`, `file:export-sql`, `file:export-dbml`, `edit:add-table`,
  `edit:add-note`, `edit:add-area`, `view:toggle-sidebar`, `view:toggle-grid`,
  `view:zoom-in`, `view:zoom-out`, `view:reset-zoom`).
- The plan does not mention the theme. The editor hands the theme of the prop to the
  `NConfigProvider` of Naive UI.

## Environment work

- **The context of a plugin lost the members of the host.** The core built the context
  of a plugin as a new object with the four members of the core context, so the
  members the SDK added would have been dropped. The core now builds the context with
  `Object.create(base)`, which keeps the members of the host and their live getters.
- **The single file components are not type checked.** The plain `tsc` of the workspace
  does not understand `.vue` files, so the props of the editor are declared at runtime
  with `PropType` (the ruling of Task 11) and the spec casts the instance of the
  component to the interface of the exposed methods.
- **`Point` was exported twice.** The geometry of the canvas and the viewport of the
  composables both exported a `Point`. The geometry now exports a `GeometryPoint`, so
  that the entry point of the package can export the `Point` of the viewport.
- **The pinia has to be installed.** A store that is used in a component of an
  application without `app.use(pinia)` looks for the pinia through the injection and
  warns. The spec installs the pinia as a plugin of the mounted application, and the
  package offers `DrawDBVueSdk` for the host applications.
- **The automatic saving must not keep the process alive.** The timer of the automatic
  saving is unref'd when the runtime supports it, so that a Node process that renders
  the editor on the server can end.

## Tests

`packages/sdk/src/components/DrawDBEditor.test.ts` — 15 specs:

1. renders the canvas and the side panel
2. renders the header
3. applies the initial value in the uncontrolled mode
4. applies the model value in the controlled mode
5. emits update:modelValue and change when the diagram changes
6. keeps the history when the parent sends the emitted diagram back
7. hides the side panel in the readonly mode
8. saves the diagram with the storage adapter and emits save
9. auto saves when the interval elapses
10. activates the plugins and gives them the stores
11. runs a command that a plugin registered
12. exports the SQL of the diagram
13. imports SQL into the diagram
14. changes the database of the diagram
15. toggles the side panel of the editor

Workspace suite: 281/281 specs pass. `pnpm run typecheck` is clean.
