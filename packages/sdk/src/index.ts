import type { App, Plugin } from "vue";
import type { Pinia } from "pinia";
import { DrawDBEditor } from "./components/index.ts";

/**
 * The public entry point of the Vue SDK.
 *
 * The package offers the `DrawDBEditor` component, the stores and the
 * composables of the editor. A host application can use them directly or
 * install the SDK as a Vue plugin.
 */

export * from "./components/index.ts";
export * from "./composables/index.ts";
export * from "./stores/index.ts";
export * from "./types/sdk-options.ts";
export * from "./utils/elements.ts";
export {
  LANGUAGES,
  availableLocales,
  createI18n,
  getLocale,
  localeMessages,
  resolveLocale,
  setLocale,
  t,
} from "./i18n/index.ts";
export type { Language, SdkI18n } from "./i18n/index.ts";

/** The options of the Vue plugin of the SDK. */
export interface DrawDBVueSdkOptions {
  /** The pinia instance the stores of the editor use. */
  pinia?: Pinia;
}

/**
 * The Vue plugin of the SDK.
 *
 * It installs the pinia instance of the host application and registers the
 * `DrawDBEditor` component under the same name.
 */
export const DrawDBVueSdk: Plugin<[DrawDBVueSdkOptions?]> = {
  install(app: App, options: DrawDBVueSdkOptions = {}) {
    if (options.pinia) {
      app.use(options.pinia);
    }
    app.component("DrawDBEditor", DrawDBEditor);
  },
};

export default DrawDBVueSdk;
