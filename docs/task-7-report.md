# Task 7 Report — Metadata & Plugin Systems

**Status:** Complete
**Plan section:** `sdk-workspace/docs/plan.md:436-496`
**Test result:** metadata registry 11/11, plugin manager 16/16; full workspace suite
169/169 pass; `pnpm run typecheck` clean.

## What was built

### Metadata system — `packages/core/src/metadata/`

`metadata-schema.ts`

- `MetadataTarget` — `diagram | table | field | relationship | view | note | area`.
- `MetadataPropertyType` — `string | number | boolean | object | array | any`.
- `MetadataProperty` — `{ key, label?, type, required?, default?, description?, options? }`.
- `MetadataSchema` — `{ id, name?, description?, target, properties }`.
- `MetadataValidationIssue` — `{ schemaId, key, message }`.
- `matchesPropertyType(value, type)` — runtime type check.
- `validateMetadataValues(values, schema)` — returns the issues it finds:
  - missing required property → `"x" is required.`
  - wrong type → `"x" must be of type T.`
  - value outside `options` → an options violation
  - unknown property → `Unknown property "x".`

`metadata-registry.ts`

- `MetadataSchemaRegistryError`.
- `MetadataRegistry` with `register`, `unregister`, `get`, `list(target?)`, `has`, `clear`,
  `validate(schemaId, values)` and `applyDefaults(schemaId, values)`.

`metadata-registry.test.ts` — 11 cases covering registration, listing by target,
unregistration, required/type/options/unknown validation and default application.

### Plugin system — `packages/core/src/plugins/`

`extension-points.ts`

- `EXTENSION_POINTS` — `toolbar | context-menu | panel | dialog | command | field-type | export-format`.
- `isExtensionPoint(value)`.
- `Extension<THandler>` — `{ id, point, priority?, handler }`.

`plugin.ts`

- `PluginContext` — `{ readonly diagram, readonly metadata, registerExtension, getStore }`.
- `Plugin` — `{ id, name, version, description?, author?, activate(context), deactivate?() }`.

`plugin-manager.ts`

- `PluginManager` with `register`, `unregister`, `get`, `list`, `getActiveIds`, `isActive`,
  `activate`, `deactivate`, `activateAll`, `deactivateAll`, `registerExtension` and
  `getExtensions(point)`.
- `activateAll` returns `{ activated, failed }`: a plugin that throws does not stop the
  others, the failure is reported instead.
- `deactivateAll` swallows per-plugin errors for the same reason.
- `getExtensions` returns the extensions of one point, highest `priority` first;
  extensions with the same priority keep their registration order.
- Extensions contributed by a plugin are attributed to that plugin and removed again
  when it is deactivated or unregistered.

`plugin-manager.test.ts` — 16 cases.

## Design decisions worth knowing

- **Extension ownership.** `PluginManager.createContext(base, owner)` builds the context
  handed to a plugin and binds `registerExtension` in a closure that records the owner.
  The first draft of the manager referenced a `this.currentOwner` field that was never
  assigned, so a plugin's extensions could never be attributed to it and were never
  removed on deactivation. The closure-based design fixed that.
- **Activation is asynchronous.** `activate` marks the plugin active *before* awaiting
  `plugin.activate(...)` and removes the mark again when the plugin throws, so a plugin
  that fails half-way does not stay registered as active.
- **Framework agnostic.** The manager knows nothing about Vue or Pinia. The SDK wires it
  into a Pinia store later; `getStore(storeId)` gives a plugin access to the host
  application state without the core package depending on the SDK.

## Bug found and fixed

The first version of the manager kept the owner in a `this.currentOwner` field that was
never assigned. `registerExtension` therefore always stored an owner-less extension and
`removeExtensionsOf` could never match. Rewritten with the `createContext(base, owner)`
closure described above.

Two tests also had to be corrected: `activateAll` / `deactivateAll` assert after an
`await` (activation continues past an await boundary), and "activating an unknown plugin"
is a rejection rather than a synchronous throw because `activate` is `async`.
