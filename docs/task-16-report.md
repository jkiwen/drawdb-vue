# Task 16 — Migrate i18n Locales

## Scope

The React application keeps its translations in JavaScript modules with the
shape of i18next (`{ translation: { ... } }`). The SDK speaks Vue I18n, which
expects the messages of a locale directly.

The task migrates the locales of drawDB into the SDK:

- `packages/sdk/src/i18n/index.ts` — the module of the translations,
- `packages/sdk/src/i18n/locales/*.json` — one file per locale,
- `packages/sdk/src/i18n/languages.ts` — the list of the languages,
- `scripts/migrate-i18n.ts` — the script that writes the files,
- `scripts/generate-i18n-index.mjs` — the script that writes the imports.

## Dependencies

- The locales of the React application (`src/i18n/locales/*.js`), which the
  migration script reads.
- `vue-i18n`, which was added as a dependency of `@drawdb/vue-sdk`.

## The module of the translations

`packages/sdk/src/i18n/index.ts` offers:

| Export | Description |
| --- | --- |
| `createI18n(locale)` | An instance of Vue I18n with the messages of the SDK. The function is asynchronous, so that the locales can be loaded lazily later on. |
| `localeMessages` | The messages of every locale. |
| `availableLocales` | The codes of the locales. |
| `LANGUAGES` | The languages with their name and their native name. |
| `resolveLocale(locale)` | The locale of the SDK that fits a locale of the browser. |
| `setLocale(locale)`, `getLocale()`, `t(key, params)` | The shared instance the SDK uses for its own labels. |

The instance is created in the mode of the composition API (`legacy: false`),
because the mode of the legacy API is deprecated in Vue I18n 11. The type of
Vue I18n is a union of the two modes, so the module declares the type of the
instance it returns (`SdkI18n`) with the composer of the composition API.

The shared instance means that a host application does not have to install Vue
I18n to use the SDK.

The editor follows the `locale` prop: it sets the locale of the shared
instance when it is mounted and when the prop changes.

## The migration

`scripts/migrate-i18n.ts` reads the locales of the React application, which
lives next to the workspace (the directory can be given with `--source`).

The script:

- writes the messages of every locale as a JSON file, with the keys in
  alphabetical order,
- fills the keys a translation does not have with the English text, so that
  every locale has the same keys,
- adds the keys the SDK needs and drawDB does not have (`table`, `field`,
  `fields`, `relationship`, `area` and `areas`); the English and the
  Simplified Chinese are written by hand, the other locales fall back to
  English,
- writes the list of the languages.

51 locales are migrated; the plan asked for 36.

The code of the simplified Chinese is `zh-CN` in the SDK, the browsers send
`zh-CN` and `zh-Hans`, and the application calls it `zh`. `resolveLocale`
knows the aliases of the browsers (`zh`, `zh-Hans`, `zh-Hant`, `zh-HK`, `pt`,
`ja`, `in`, `iw`) and falls back to English for an unknown locale.

The imports of the 51 files are written into the module by
`scripts/generate-i18n-index.mjs`, between two markers. The names of the
imports carry a prefix, because a code can be a word of the language
(`as` for Assamese).

## Differences from the plan

- The plan mentions a script for the locales and the manual migration of
  English and Simplified Chinese. The script migrates every locale; the manual
  part is the six keys the SDK adds to the two locales.
- The plan counts 36 locales; the script migrates the 51 locales of the
  application.
- The module offers more than `createI18n`: the list of the languages, the
  resolution of the locale of the browser and a shared instance, so that the
  components of the SDK can translate their labels without a host application.

## Environment work

- `vue-i18n` and its runtime packages (`@intlify/core-base`,
  `@intlify/message-compiler` and `@intlify/shared`) are dependencies of
  `@drawdb/vue-sdk`. The linker of the workspace cannot reach the transitive
  packages of a package of the workspace, so they are declared explicitly,
  like `vue-demi` and `@vue/devtools-api` of Task 9.
- The locales are imported with the attribute `with { type: "json" }`, which
  Node needs for a JSON file and which the bundlers of the workspace
  understand.

## Tests

`packages/sdk/src/i18n/index.test.ts` — 9 specifications:

- the English and the Chinese translations are loaded,
- an unknown locale falls back to English,
- a locale with a region is resolved,
- every locale of the application is offered and every language is named,
- every locale has the same keys as English,
- the shared instance translates.

The specification of the editor gained a specification for the `locale` prop.

The whole suite of the workspace passes (299 specifications) and the type check
of the two packages is clean.
